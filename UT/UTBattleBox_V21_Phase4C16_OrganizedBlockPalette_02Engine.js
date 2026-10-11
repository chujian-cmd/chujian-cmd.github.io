/**
 * UTBattleBox V21.0 Phase 4C.16 OrganizedBlockPalette
 * 02Engine/TurboWarp Runtime + Native Scratch Renderer Layer
 *
 * 目标：
 * - 无外部依赖
 * - 固定 60 Hz 物理时间步
 * - 红魂二维移动、蓝魂四向重力
 * - SDF / CSG 非规则战斗区域
 * - Solid / Trigger 分离
 * - 热路径不创建临时对象
 *
 * 已知限制：
 * - 移动碰撞为自适应子步，不是严格连续碰撞
 * - Trigger 使用固定步起终点直线采样
 * - 非等比缩放使用保守近似距离
 */
(function (globalEnv) {
  'use strict';

  // ==================== 环境 ====================
  const ScratchExt = typeof Scratch !== 'undefined' ? Scratch : globalEnv.Scratch;
  const HAS_SCRATCH = Boolean(ScratchExt && ScratchExt.extensions);
  const IS_CONFIRMED_UNSANDBOXED = Boolean(
    HAS_SCRATCH && ScratchExt.extensions.unsandboxed === true
  );

  if (HAS_SCRATCH && ScratchExt.extensions.unsandboxed === false) {
    throw new Error('[UTBattleBox V21] 核心引擎不能在已确认的沙盒环境运行。');
  }

  function getNowMs() {
    if (
      globalEnv.performance &&
      typeof globalEnv.performance.now === 'function'
    ) {
      return globalEnv.performance.now();
    }
    return Date.now();
  }

  // ==================== 常量与枚举 ====================
  const ENGINE_EPSILON = 1e-9;
  const CONTACT_SLOP = 1e-4;
  const MAX_TRIGGER_SAMPLES = 256;
  const FIXED_DT = 1 / 60;
  const EMPTY_OBSTACLES = Object.freeze([]);

  const CSGType = Object.freeze({
    UNION: 0,
    SUBTRACT: 1,
    INTERSECT: 2
  });

  const LayerMask = Object.freeze({
    SOUL: 1 << 0,
    BULLET: 1 << 1,
    LASER: 1 << 2,
    SAFE: 1 << 3,
    ALL: 0x7fffffff
  });

  const CollisionResponse = Object.freeze({
    TRIGGER: 0,
    SOLID: 1,
    SOLID_AND_TRIGGER: 2
  });

  // ==================== 数学 ====================
  class Vec2 {
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }

    set(x, y) {
      this.x = x;
      this.y = y;
      return this;
    }

    copyFrom(other) {
      this.x = other.x;
      this.y = other.y;
      return this;
    }

    negate() {
      this.x = -this.x;
      this.y = -this.y;
      return this;
    }

    scale(value) {
      this.x *= value;
      this.y *= value;
      return this;
    }

    dot(other) {
      return this.x * other.x + this.y * other.y;
    }

    lengthSq() {
      return this.x * this.x + this.y * this.y;
    }
  }

  class Transform2D {
    constructor(x = 0, y = 0, rotation = 0, sx = 1, sy = 1) {
      this.pos = new Vec2(x, y);
      this._rotation = rotation;
      this._scaleX = sx;
      this._scaleY = sy;

      this.cos = 1;
      this.sin = 0;
      this.invSx = 1;
      this.invSy = 1;
      this.distanceScale = 1;
      this.hasExactDistance = true;
      this.valid = true;

      this._updateMatrix();
    }

    get rotation() {
      return this._rotation;
    }

    set rotation(value) {
      this._rotation = value;
      this._updateMatrix();
    }

    get scaleX() {
      return this._scaleX;
    }

    set scaleX(value) {
      this._scaleX = value;
      this._updateMatrix();
    }

    get scaleY() {
      return this._scaleY;
    }

    set scaleY(value) {
      this._scaleY = value;
      this._updateMatrix();
    }

    setPosition(x, y) {
      this.pos.set(x, y);
      return this;
    }

    setRotation(rotation) {
      this.rotation = rotation;
      return this;
    }

    setScale(sx, sy = sx) {
      this._scaleX = sx;
      this._scaleY = sy;
      this._updateMatrix();
      return this;
    }

    _updateMatrix() {
      const sx = this._scaleX;
      const sy = this._scaleY;

      this.valid = Boolean(
        Number.isFinite(this._rotation) &&
        Number.isFinite(sx) &&
        Number.isFinite(sy) &&
        Math.abs(sx) > ENGINE_EPSILON &&
        Math.abs(sy) > ENGINE_EPSILON
      );

      if (!this.valid) {
        this.cos = 1;
        this.sin = 0;
        this.invSx = 0;
        this.invSy = 0;
        this.distanceScale = 0;
        this.hasExactDistance = false;
        return false;
      }

      this.cos = Math.cos(-this._rotation);
      this.sin = Math.sin(-this._rotation);
      this.invSx = 1 / sx;
      this.invSy = 1 / sy;

      const absSx = Math.abs(sx);
      const absSy = Math.abs(sy);
      this.hasExactDistance = Math.abs(absSx - absSy) <= ENGINE_EPSILON;
      this.distanceScale = Math.min(absSx, absSy);
      return true;
    }

    applyInverseTo(out, worldX, worldY) {
      if (!this.valid) {
        out.set(NaN, NaN);
        return false;
      }

      const dx = worldX - this.pos.x;
      const dy = worldY - this.pos.y;
      const rx = dx * this.cos - dy * this.sin;
      const ry = dx * this.sin + dy * this.cos;

      out.x = rx * this.invSx;
      out.y = ry * this.invSy;
      return true;
    }
  }

  // ==================== SDF ====================
  const SDF = {
    roundedBox(point, halfSize, radius) {
      const hx = Math.max(0, halfSize.x);
      const hy = Math.max(0, halfSize.y);
      const r = Math.max(0, Math.min(radius, hx, hy));

      const qx = Math.abs(point.x) - hx + r;
      const qy = Math.abs(point.y) - hy + r;
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);

      return (
        Math.sqrt(ox * ox + oy * oy) +
        Math.min(Math.max(qx, qy), 0) -
        r
      );
    },

    capsule(point, halfHeight, radius) {
      const hh = Math.max(0, halfHeight);
      const r = Math.max(0, radius);
      const clampedY = Math.max(-hh, Math.min(hh, point.y));
      const dx = point.x;
      const dy = point.y - clampedY;
      return Math.sqrt(dx * dx + dy * dy) - r;
    },

    circle(point, radius) {
      return (
        Math.sqrt(point.x * point.x + point.y * point.y) -
        Math.max(0, radius)
      );
    },

    polygon(point, vertices) {
      const count = Array.isArray(vertices) ? vertices.length : 0;
      if (count < 3) return Infinity;

      let minDistanceSq = Infinity;
      let inside = false;
      let validEdgeCount = 0;

      for (let i = 0, j = count - 1; i < count; j = i++) {
        const vi = vertices[i];
        const vj = vertices[j];

        if (
          !vi ||
          !vj ||
          !Number.isFinite(vi.x) ||
          !Number.isFinite(vi.y) ||
          !Number.isFinite(vj.x) ||
          !Number.isFinite(vj.y)
        ) {
          continue;
        }

        const ex = vj.x - vi.x;
        const ey = vj.y - vi.y;
        const edgeLengthSq = ex * ex + ey * ey;
        if (edgeLengthSq <= ENGINE_EPSILON) continue;

        validEdgeCount++;

        const wx = point.x - vi.x;
        const wy = point.y - vi.y;
        const projection = Math.max(
          0,
          Math.min(1, (wx * ex + wy * ey) / edgeLengthSq)
        );

        const bx = wx - ex * projection;
        const by = wy - ey * projection;
        const distanceSq = bx * bx + by * by;
        if (distanceSq < minDistanceSq) minDistanceSq = distanceSq;

        if ((vi.y > point.y) !== (vj.y > point.y)) {
          const intersectX = vi.x + ((point.y - vi.y) * ex) / ey;
          if (point.x < intersectX) inside = !inside;
        }
      }

      if (validEdgeCount < 3 || !Number.isFinite(minDistanceSq)) {
        return Infinity;
      }

      const distance = Math.sqrt(minDistanceSq);
      return inside ? -distance : distance;
    }
  };

  // ==================== SDF 节点 ====================
  class ShapeNode {
    constructor(type, sourceParams = {}) {
      this.type = type;
      this.tmp = new Vec2();

      const source =
        sourceParams && typeof sourceParams === 'object'
          ? sourceParams
          : {};

      if (type === 'box') {
        const sourceHalfSize = source.h || {};
        this.params = {
          h: new Vec2(
            Number.isFinite(sourceHalfSize.x)
              ? Math.max(0, sourceHalfSize.x)
              : 50,
            Number.isFinite(sourceHalfSize.y)
              ? Math.max(0, sourceHalfSize.y)
              : 50
          ),
          r: Number.isFinite(source.r) ? Math.max(0, source.r) : 0
        };
      } else if (type === 'capsule') {
        this.params = {
          hh: Number.isFinite(source.hh) ? Math.max(0, source.hh) : 50,
          r: Number.isFinite(source.r) ? Math.max(0, source.r) : 10
        };
      } else if (type === 'circle') {
        this.params = {
          r: Number.isFinite(source.r) ? Math.max(0, source.r) : 10
        };
      } else if (type === 'polygon') {
        const vertices = [];
        if (Array.isArray(source.vertices)) {
          for (let i = 0; i < source.vertices.length; i++) {
            const vertex = source.vertices[i];
            if (
              vertex &&
              Number.isFinite(vertex.x) &&
              Number.isFinite(vertex.y)
            ) {
              vertices.push(new Vec2(vertex.x, vertex.y));
            }
          }
        }
        this.params = { vertices };
      } else {
        this.params = {};
      }
    }

    distance(x, y) {
      this.tmp.set(x, y);

      switch (this.type) {
        case 'box':
          return SDF.roundedBox(this.tmp, this.params.h, this.params.r);
        case 'capsule':
          return SDF.capsule(this.tmp, this.params.hh, this.params.r);
        case 'circle':
          return SDF.circle(this.tmp, this.params.r);
        case 'polygon':
          return SDF.polygon(this.tmp, this.params.vertices);
        default:
          return Infinity;
      }
    }
  }

  class TransformNode {
    constructor(child, transform = new Transform2D()) {
      this.child = child;
      this.transform = transform;
      this.tmp = new Vec2();
    }

    distance(x, y) {
      if (
        !this.child ||
        typeof this.child.distance !== 'function' ||
        !this.transform ||
        typeof this.transform.applyInverseTo !== 'function' ||
        !this.transform.applyInverseTo(this.tmp, x, y)
      ) {
        return Infinity;
      }

      const localDistance = this.child.distance(this.tmp.x, this.tmp.y);
      if (!Number.isFinite(localDistance)) return localDistance;
      return localDistance * this.transform.distanceScale;
    }
  }

  class CSGNode {
    constructor(type = CSGType.UNION, children = []) {
      this.type = type;
      this.children = Array.isArray(children) ? children : [];
    }

    distance(x, y) {
      const count = this.children.length;
      if (count === 0) return Infinity;

      if (this.type === CSGType.UNION) {
        let result = Infinity;
        for (let i = 0; i < count; i++) {
          const child = this.children[i];
          if (child && typeof child.distance === 'function') {
            const distance = child.distance(x, y);
            if (distance < result) result = distance;
          }
        }
        return result;
      }

      if (this.type === CSGType.SUBTRACT) {
        const first = this.children[0];
        if (!first || typeof first.distance !== 'function') return Infinity;

        let result = first.distance(x, y);
        for (let i = 1; i < count; i++) {
          const child = this.children[i];
          if (child && typeof child.distance === 'function') {
            result = Math.max(result, -child.distance(x, y));
          }
        }
        return result;
      }

      if (this.type === CSGType.INTERSECT) {
        let result = -Infinity;
        for (let i = 0; i < count; i++) {
          const child = this.children[i];
          if (!child || typeof child.distance !== 'function') return Infinity;

          const distance = child.distance(x, y);
          if (distance > result) result = distance;
        }
        return result;
      }

      return Infinity;
    }
  }

  // ==================== 世界 ====================
  class SDFWorld {
    constructor(rootNode = null) {
      this.root = rootNode;
      this.version = 0;
    }

    setRoot(rootNode) {
      if (this.root !== rootNode) {
        this.root = rootNode;
        this.version++;
      }
      return this;
    }

    touch() {
      this.version++;
      return this;
    }

    distance(x, y) {
      if (!this.root || typeof this.root.distance !== 'function') {
        return Infinity;
      }
      return this.root.distance(x, y);
    }

    gradientTo(out, x, y, epsilon = 0.5) {
      if (!out || typeof out.set !== 'function') return false;

      const epsilonNumber = Number(epsilon);
      const safeEpsilon = Number.isFinite(epsilonNumber)
        ? Math.max(0.0001, Math.abs(epsilonNumber))
        : 0.5;

      const positiveX = this.distance(x + safeEpsilon, y);
      const negativeX = this.distance(x - safeEpsilon, y);
      const positiveY = this.distance(x, y + safeEpsilon);
      const negativeY = this.distance(x, y - safeEpsilon);

      if (
        !Number.isFinite(positiveX) ||
        !Number.isFinite(negativeX) ||
        !Number.isFinite(positiveY) ||
        !Number.isFinite(negativeY)
      ) {
        out.set(0, 0);
        return false;
      }

      const dx = positiveX - negativeX;
      const dy = positiveY - negativeY;
      const lengthSq = dx * dx + dy * dy;

      if (!Number.isFinite(lengthSq) || lengthSq <= ENGINE_EPSILON) {
        out.set(0, 0);
        return false;
      }

      const inverseLength = 1 / Math.sqrt(lengthSq);
      out.set(dx * inverseLength, dy * inverseLength);
      return true;
    }
  }

  // ==================== 碰撞 ====================
  class CollisionResult {
    constructor() {
      this.collided = false;
      this.valid = true;
      this.normalValid = false;
      this.distance = Infinity;
      this.penetration = 0;
      this.normal = new Vec2();
      this.correction = new Vec2();
    }

    reset() {
      this.collided = false;
      this.valid = true;
      this.normalValid = false;
      this.distance = Infinity;
      this.penetration = 0;
      this.normal.set(0, 0);
      this.correction.set(0, 0);
      return this;
    }
  }

  class CollisionSystem {
    static masksAllow(layerA, maskA, layerB, maskB) {
      return (maskA & layerB) !== 0 && (maskB & layerA) !== 0;
    }

    static canSolidCollideWithSoul(
      obstacle,
      soulLayer = LayerMask.SOUL,
      soulMask = LayerMask.ALL
    ) {
      return Boolean(
        obstacle &&
        obstacle.enabled &&
        typeof obstacle.isSolid === 'function' &&
        obstacle.isSolid() &&
        obstacle.world &&
        typeof obstacle.world.distance === 'function' &&
        typeof obstacle.world.gradientTo === 'function' &&
        this.masksAllow(
          obstacle.layer,
          obstacle.mask,
          soulLayer,
          soulMask
        )
      );
    }

    static checkCircleInsideArea(
      world,
      centerX,
      centerY,
      radius,
      out,
      gradientEpsilon = 0.5
    ) {
      if (
        !world ||
        typeof world.distance !== 'function' ||
        typeof world.gradientTo !== 'function' ||
        !out ||
        typeof out.reset !== 'function'
      ) {
        return false;
      }

      out.reset();
      const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0;
      const distance = world.distance(centerX, centerY);
      out.distance = distance;

      if (!Number.isFinite(distance)) {
        out.valid = false;
        return false;
      }

      if (distance + safeRadius <= CONTACT_SLOP) return false;

      const penetration = distance + safeRadius - CONTACT_SLOP;
      out.collided = true;
      out.penetration = penetration;
      out.normalValid = world.gradientTo(
        out.normal,
        centerX,
        centerY,
        gradientEpsilon
      );

      if (out.normalValid) {
        out.normal.negate();
        out.correction.set(
          out.normal.x * penetration,
          out.normal.y * penetration
        );
      }

      return true;
    }

    static checkCircleAgainstObstacle(
      world,
      centerX,
      centerY,
      radius,
      out,
      gradientEpsilon = 0.5
    ) {
      if (
        !world ||
        typeof world.distance !== 'function' ||
        typeof world.gradientTo !== 'function' ||
        !out ||
        typeof out.reset !== 'function'
      ) {
        return false;
      }

      out.reset();
      const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0;
      const distance = world.distance(centerX, centerY);
      out.distance = distance;

      if (!Number.isFinite(distance)) {
        out.valid = false;
        return false;
      }

      if (safeRadius - distance <= CONTACT_SLOP) return false;

      const penetration = safeRadius - distance - CONTACT_SLOP;
      out.collided = true;
      out.penetration = penetration;
      out.normalValid = world.gradientTo(
        out.normal,
        centerX,
        centerY,
        gradientEpsilon
      );

      if (out.normalValid) {
        out.correction.set(
          out.normal.x * penetration,
          out.normal.y * penetration
        );
      }

      return true;
    }
  }

  // ==================== Hitbox / Trigger ====================
  class Hitbox {
    constructor(
      id,
      shapeNode,
      damage = 10,
      layer = LayerMask.BULLET,
      mask = LayerMask.SOUL,
      response = CollisionResponse.TRIGGER
    ) {
      this.id = id;
      this.shape = shapeNode;
      this.world = new SDFWorld(shapeNode);
      this.damage = Number.isFinite(damage) ? Math.max(0, damage) : 10;
      this.layer = layer;
      this.mask = mask;
      this.response = response;
      this.enabled = true;
    }

    setShape(shapeNode) {
      this.shape = shapeNode;
      this.world.setRoot(shapeNode);
      return this;
    }

    isSolid() {
      return (
        this.response === CollisionResponse.SOLID ||
        this.response === CollisionResponse.SOLID_AND_TRIGGER
      );
    }

    isTrigger() {
      return (
        this.response === CollisionResponse.TRIGGER ||
        this.response === CollisionResponse.SOLID_AND_TRIGGER
      );
    }
  }

  class AttackSystem {
    // 固定步起点到终点的直线路径采样；不是严格连续碰撞。
    static testSoulPathSampled(soul, hitboxes, onHitCallback) {
      if (
        !soul ||
        typeof onHitCallback !== 'function' ||
        !Array.isArray(hitboxes) ||
        soul.teleportedThisStep
      ) {
        return 0;
      }

      let hitCount = 0;
      const radius = Number.isFinite(soul.radius)
        ? Math.max(0.001, soul.radius)
        : 8;

      const previousX = Number.isFinite(soul.previousX)
        ? soul.previousX
        : Number.isFinite(soul.x)
          ? soul.x
          : 0;
      const previousY = Number.isFinite(soul.previousY)
        ? soul.previousY
        : Number.isFinite(soul.y)
          ? soul.y
          : 0;
      const currentX = Number.isFinite(soul.x) ? soul.x : previousX;
      const currentY = Number.isFinite(soul.y) ? soul.y : previousY;

      const moveX = currentX - previousX;
      const moveY = currentY - previousY;
      const movementLength = Math.sqrt(moveX * moveX + moveY * moveY);
      const sampleSpacing = Math.max(0.05, radius * 0.5);
      const requiredSteps = Math.ceil(movementLength / sampleSpacing);
      const steps = Math.min(
        MAX_TRIGGER_SAMPLES,
        Math.max(1, Number.isFinite(requiredSteps) ? requiredSteps : 1)
      );
      const stepX = moveX / steps;
      const stepY = moveY / steps;

      for (let i = 0; i < hitboxes.length; i++) {
        const hitbox = hitboxes[i];

        if (
          !hitbox ||
          !hitbox.enabled ||
          typeof hitbox.isTrigger !== 'function' ||
          !hitbox.isTrigger() ||
          !hitbox.world ||
          typeof hitbox.world.distance !== 'function'
        ) {
          continue;
        }

        if (
          !CollisionSystem.masksAllow(
            hitbox.layer,
            hitbox.mask,
            LayerMask.SOUL,
            LayerMask.ALL
          )
        ) {
          continue;
        }

        for (let sample = 0; sample <= steps; sample++) {
          const sampleX = previousX + stepX * sample;
          const sampleY = previousY + stepY * sample;
          const distance = hitbox.world.distance(sampleX, sampleY);

          if (Number.isFinite(distance) && distance <= radius) {
            const invulnerabilityTime = Number.isFinite(
              soul.invulnerabilityTime
            )
              ? soul.invulnerabilityTime
              : 0;

            if (invulnerabilityTime <= 0) {
              const duration = Number.isFinite(soul.invulnerabilityDuration)
                ? Math.max(0, soul.invulnerabilityDuration)
                : 1;

              soul.invulnerabilityTime = duration;
              onHitCallback(hitbox, soul);
              hitCount++;
            }

            break;
          }
        }
      }

      return hitCount;
    }
  }

  // ==================== 重力与 Soul ====================
  class GravitySystem {
    constructor() {
      // normal 表示反重力/支撑方向。
      this.normal = new Vec2();
      this.tangent = new Vec2();
      this.direction = 'down';
      this.version = 0;
      this.setDirection('down');
    }

    setDirection(direction) {
      let nextDirection = direction;
      if (
        nextDirection !== 'down' &&
        nextDirection !== 'up' &&
        nextDirection !== 'left' &&
        nextDirection !== 'right'
      ) {
        nextDirection = 'down';
      }

      if (this.direction !== nextDirection) this.version++;
      this.direction = nextDirection;

      switch (nextDirection) {
        case 'down':
          this.normal.set(0, 1);
          this.tangent.set(1, 0);
          break;
        case 'up':
          this.normal.set(0, -1);
          this.tangent.set(-1, 0);
          break;
        case 'left':
          this.normal.set(1, 0);
          this.tangent.set(0, -1);
          break;
        case 'right':
          this.normal.set(-1, 0);
          this.tangent.set(0, 1);
          break;
      }

      return this;
    }
  }

  class Soul {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.radius = 8;
      this.previousX = 0;
      this.previousY = 0;

      this.teleportedThisStep = false;
      this.recoveryFailedThisStep = false;
      // 当前固定步是否正在把方向输入重定向到接触面的切线。
      this.surfaceSlidingThisStep = false;
      // 蓝魂是否正在因为重力沿斜墙/斜坡切线自然下滑。
      this.gravitySlidingThisStep = false;

      this._lastLegalX = 0;
      this._lastLegalY = 0;
      this._hasLastLegalPosition = false;
      this._battleWorld = null;
      this._battleWorldVersion = -1;

      this.mode = 'red';
      this.isGrounded = false;
      this.invulnerabilityTime = 0;
      this.invulnerabilityDuration = 1;

      this.inputVelocity = new Vec2();
      this.gravityVelocity = new Vec2();
      this.externalVelocity = new Vec2();

      this._jumpWasDown = false;
      this._gravityVersion = -1;
      this._colResult = new CollisionResult();
      this._probeResult = new CollisionResult();
      this._lastContactNormal = new Vec2();
    }

    clearRecoveryAnchor() {
      this._lastLegalX = 0;
      this._lastLegalY = 0;
      this._hasLastLegalPosition = false;
      this._lastContactNormal.set(0, 0);
      return this;
    }

    setPosition(x, y, markAsLegal = false, preserveOldAnchor = false) {
      this.x = Number.isFinite(x) ? x : 0;
      this.y = Number.isFinite(y) ? y : 0;
      this.previousX = this.x;
      this.previousY = this.y;

      this.inputVelocity.set(0, 0);
      this.gravityVelocity.set(0, 0);
      this.externalVelocity.set(0, 0);
      this._lastContactNormal.set(0, 0);

      this.isGrounded = false;
      this._jumpWasDown = false;
      this.recoveryFailedThisStep = false;
      this.surfaceSlidingThisStep = false;
      this.gravitySlidingThisStep = false;

      if (!preserveOldAnchor) {
        this._hasLastLegalPosition = false;
      }

      if (markAsLegal) {
        this._lastLegalX = this.x;
        this._lastLegalY = this.y;
        this._hasLastLegalPosition = true;
      }

      this.teleportedThisStep = true;
      return this;
    }
  }

  class SoulController {
    constructor(gravitySystem) {
      this.gravity = gravitySystem;
      this.speed = 180;
      this.jumpForce = 360;
      this.maxFall = 480;
      this.gravityAccel = 1440;
      this.externalDamping = 0.9;

      // 灵魂移动求解档位：
      // precise = 原有高精度自适应子步；
      // fast = 限制子步、求解循环和重复合法性检查，优先保证老设备帧时间。
      this.movementAlgorithm = 'precise';

      // UT 风格斜面蹭墙：靠近接触面时，将“压向墙面”的输入重定向到切线。
      // 红魂使用完整二维输入；蓝魂只在接触面上临时接纳纵向输入。
      this.surfaceInputRoutingEnabled = true;
      this.surfaceProbeDistance = 1.25;
      // 0 = 保留正交投影后的自然速度；1 = 沿斜面恢复到完整输入速度。
      this.surfaceSpeedPreservation = 1;

      // 蓝魂斜墙自然下滑：把重力投影到最近接触面的切线。
      this.slopeGravitySlidingEnabled = true;
      this.slopeGravityScale = 1;
      // 接触法线几乎完全朝向重力反方向时视为平地，不产生切向滑动。
      this.slopeGravityFlatDot = 0.9985;
    }

    setMovementAlgorithm(mode) {
      this.movementAlgorithm = mode === 'fast' ? 'fast' : 'precise';
      return this.movementAlgorithm;
    }

    getMovementAlgorithm() {
      return this.movementAlgorithm === 'fast' ? 'fast' : 'precise';
    }

    _isFullVector(value) {
      return Boolean(
        value &&
        typeof value.x === 'number' &&
        typeof value.y === 'number' &&
        typeof value.set === 'function' &&
        typeof value.copyFrom === 'function' &&
        typeof value.negate === 'function' &&
        typeof value.scale === 'function' &&
        typeof value.dot === 'function' &&
        typeof value.lengthSq === 'function'
      );
    }

    _sanitizeVector(vector) {
      if (!this._isFullVector(vector)) return false;

      if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y)) {
        vector.set(0, 0);
      }

      return true;
    }

    _isCollisionResult(value) {
      return Boolean(
        value &&
        typeof value.reset === 'function' &&
        this._isFullVector(value.normal) &&
        this._isFullVector(value.correction)
      );
    }

    _validateSoulStructure(soul) {
      return Boolean(
        soul &&
        this._isFullVector(soul.inputVelocity) &&
        this._isFullVector(soul.gravityVelocity) &&
        this._isFullVector(soul.externalVelocity) &&
        this._isFullVector(soul._lastContactNormal) &&
        this._isCollisionResult(soul._colResult) &&
        this._isCollisionResult(soul._probeResult) &&
        typeof soul.clearRecoveryAnchor === 'function'
      );
    }

    _validateGravityBasis() {
      if (
        !this.gravity ||
        !this._isFullVector(this.gravity.normal) ||
        !this._isFullVector(this.gravity.tangent)
      ) {
        return false;
      }

      const nx = this.gravity.normal.x;
      const ny = this.gravity.normal.y;
      const tx = this.gravity.tangent.x;
      const ty = this.gravity.tangent.y;

      if (
        !Number.isFinite(nx) ||
        !Number.isFinite(ny) ||
        !Number.isFinite(tx) ||
        !Number.isFinite(ty)
      ) {
        return false;
      }

      const normalLengthSq = nx * nx + ny * ny;
      const tangentLengthSq = tx * tx + ty * ty;
      const dot = nx * tx + ny * ty;

      return Boolean(
        Math.abs(normalLengthSq - 1) <= 1e-6 &&
        Math.abs(tangentLengthSq - 1) <= 1e-6 &&
        Math.abs(dot) <= 1e-6
      );
    }

    _projectVelocity(vector, normal) {
      const intoSurface = vector.x * normal.x + vector.y * normal.y;
      if (intoSurface < 0) {
        vector.x -= normal.x * intoSurface;
        vector.y -= normal.y * intoSurface;
      }
    }

    _applyGroundedSlopeGravity(soul, gravityAcceleration, maxFall) {
      soul.gravitySlidingThisStep = false;
      if (!this.slopeGravitySlidingEnabled || !soul.isGrounded) return false;

      let normalX = soul._lastContactNormal.x;
      let normalY = soul._lastContactNormal.y;
      const normalLengthSq = normalX * normalX + normalY * normalY;
      if (!Number.isFinite(normalLengthSq) || normalLengthSq <= 1e-8) return false;
      if (Math.abs(normalLengthSq - 1) > 1e-5) {
        const inverse = 1 / Math.sqrt(normalLengthSq);
        normalX *= inverse;
        normalY *= inverse;
      }

      const supportDot =
        normalX * this.gravity.normal.x +
        normalY * this.gravity.normal.y;
      const flatDot = Number.isFinite(this.slopeGravityFlatDot)
        ? Math.max(0, Math.min(0.999999, this.slopeGravityFlatDot))
        : 0.9985;
      // supportDot <= 0 表示这不是承托面；接近 1 则是平地。
      if (supportDot <= 0.02 || supportDot >= flatDot) return false;

      const gravityX = -this.gravity.normal.x * gravityAcceleration;
      const gravityY = -this.gravity.normal.y * gravityAcceleration;
      const intoNormal = gravityX * normalX + gravityY * normalY;
      const tangentAccelerationX = gravityX - normalX * intoNormal;
      const tangentAccelerationY = gravityY - normalY * intoNormal;
      const tangentAccelerationSq =
        tangentAccelerationX * tangentAccelerationX +
        tangentAccelerationY * tangentAccelerationY;
      if (!Number.isFinite(tangentAccelerationSq) || tangentAccelerationSq <= 1e-6) {
        return false;
      }

      const scale = Number.isFinite(this.slopeGravityScale)
        ? Math.max(0, Math.min(4, this.slopeGravityScale))
        : 1;
      soul.gravityVelocity.x += tangentAccelerationX * FIXED_DT * scale;
      soul.gravityVelocity.y += tangentAccelerationY * FIXED_DT * scale;

      // 只保留沿接触面的分量，避免数值误差把灵魂压进墙体。
      const intoSurface =
        soul.gravityVelocity.x * normalX +
        soul.gravityVelocity.y * normalY;
      soul.gravityVelocity.x -= normalX * intoSurface;
      soul.gravityVelocity.y -= normalY * intoSurface;

      const speedSq = soul.gravityVelocity.lengthSq();
      const maxSpeed = Math.max(0, Number.isFinite(maxFall) ? maxFall : 480);
      if (speedSq > maxSpeed * maxSpeed && speedSq > 0) {
        const clampScale = maxSpeed / Math.sqrt(speedSq);
        soul.gravityVelocity.scale(clampScale);
      }

      soul.gravitySlidingThisStep = true;
      soul.surfaceSlidingThisStep = true;
      return true;
    }

    /**
     * 在不产生临时对象的前提下寻找与输入最相关的近接触面，并把输入投影到其切线。
     * 输出写入 soul._probeResult.correction；找到可用切线时返回 true。
     *
     * 法线统一指向“合法空间”：
     * - 战斗区域边界使用 -gradient；
     * - Solid 障碍使用 +gradient。
     */
    _tryRouteInputAlongSurface(
      soul,
      inputX,
      inputY,
      battleAreaWorld,
      obstacles,
      gradientEpsilon
    ) {
      soul.surfaceSlidingThisStep = false;

      if (!this.surfaceInputRoutingEnabled) return false;

      let intentX = Number.isFinite(inputX) ? inputX : 0;
      let intentY = Number.isFinite(inputY) ? inputY : 0;
      let intentLengthSq = intentX * intentX + intentY * intentY;
      if (intentLengthSq <= ENGINE_EPSILON) return false;

      if (intentLengthSq > 1) {
        const inverseLength = 1 / Math.sqrt(intentLengthSq);
        intentX *= inverseLength;
        intentY *= inverseLength;
        intentLengthSq = 1;
      }

      const intentLength = Math.sqrt(intentLengthSq);
      const configuredProbeDistance = Number.isFinite(this.surfaceProbeDistance)
        ? this.surfaceProbeDistance
        : 1.25;
      const probeDistance = Math.max(0, Math.min(8, configuredProbeDistance));
      if (probeDistance <= ENGINE_EPSILON) return false;

      // 允许很小的数值误差，但输入明显远离表面时绝不吸附。
      const releaseDot = intentLength * 0.025;
      // 防止几乎垂直撞墙时把数值噪声放大成全速切向移动。
      const minimumTangentLengthSq = intentLengthSq * 0.0064; // 8%^2

      const previousNormalX = soul._lastContactNormal.x;
      const previousNormalY = soul._lastContactNormal.y;
      const previousNormalLengthSq =
        previousNormalX * previousNormalX +
        previousNormalY * previousNormalY;

      let bestScore = -Infinity;
      let bestNormalX = 0;
      let bestNormalY = 0;

      // 候选 1：战斗区域的内边界。
      const areaDistance = battleAreaWorld.distance(soul.x, soul.y);
      if (Number.isFinite(areaDistance)) {
        // 合法区域内：distance + radius <= 0；其相反数就是到接触位置的间隙。
        const separation = -(areaDistance + soul.radius);
        if (
          separation <= probeDistance &&
          separation >= -probeDistance &&
          battleAreaWorld.gradientTo(
            soul._probeResult.normal,
            soul.x,
            soul.y,
            gradientEpsilon
          )
        ) {
          const normalX = -soul._probeResult.normal.x;
          const normalY = -soul._probeResult.normal.y;
          const normalDotIntent = intentX * normalX + intentY * normalY;
          const tangentX = intentX - normalX * normalDotIntent;
          const tangentY = intentY - normalY * normalDotIntent;
          const tangentLengthSq = tangentX * tangentX + tangentY * tangentY;

          if (
            normalDotIntent <= releaseDot &&
            tangentLengthSq > minimumTangentLengthSq
          ) {
            const normalizedSeparation = Math.max(0, separation) / probeDistance;
            let stability = 0;
            if (previousNormalLengthSq > ENGINE_EPSILON) {
              stability = Math.max(
                0,
                normalX * previousNormalX + normalY * previousNormalY
              ) * 0.05;
            }
            const score = -normalDotIntent * 4 - normalizedSeparation + stability;
            if (score > bestScore) {
              bestScore = score;
              bestNormalX = normalX;
              bestNormalY = normalY;
            }
          }
        }
      }

      // 候选 2：所有 Solid 障碍物的外边界。
      for (let i = 0; i < obstacles.length; i++) {
        const obstacle = obstacles[i];
        if (!CollisionSystem.canSolidCollideWithSoul(obstacle)) continue;

        const obstacleDistance = obstacle.world.distance(soul.x, soul.y);
        if (!Number.isFinite(obstacleDistance)) continue;

        const separation = obstacleDistance - soul.radius;
        if (separation > probeDistance || separation < -probeDistance) continue;

        if (
          !obstacle.world.gradientTo(
            soul._probeResult.normal,
            soul.x,
            soul.y,
            gradientEpsilon
          )
        ) {
          continue;
        }

        const normalX = soul._probeResult.normal.x;
        const normalY = soul._probeResult.normal.y;
        const normalDotIntent = intentX * normalX + intentY * normalY;
        const tangentX = intentX - normalX * normalDotIntent;
        const tangentY = intentY - normalY * normalDotIntent;
        const tangentLengthSq = tangentX * tangentX + tangentY * tangentY;

        if (
          normalDotIntent > releaseDot ||
          tangentLengthSq <= minimumTangentLengthSq
        ) {
          continue;
        }

        const normalizedSeparation = Math.max(0, separation) / probeDistance;
        let stability = 0;
        if (previousNormalLengthSq > ENGINE_EPSILON) {
          stability = Math.max(
            0,
            normalX * previousNormalX + normalY * previousNormalY
          ) * 0.05;
        }
        const score = -normalDotIntent * 4 - normalizedSeparation + stability;
        if (score > bestScore) {
          bestScore = score;
          bestNormalX = normalX;
          bestNormalY = normalY;
        }
      }

      if (!Number.isFinite(bestScore)) return false;

      const normalDotIntent =
        intentX * bestNormalX + intentY * bestNormalY;
      const projectedX = intentX - bestNormalX * normalDotIntent;
      const projectedY = intentY - bestNormalY * normalDotIntent;
      const projectedLengthSq =
        projectedX * projectedX + projectedY * projectedY;
      if (projectedLengthSq <= minimumTangentLengthSq) return false;

      const projectedLength = Math.sqrt(projectedLengthSq);
      const preservation = Number.isFinite(this.surfaceSpeedPreservation)
        ? Math.max(0, Math.min(1, this.surfaceSpeedPreservation))
        : 1;
      const targetLength =
        projectedLength + (intentLength - projectedLength) * preservation;
      const outputScale = targetLength / projectedLength;

      soul._probeResult.correction.set(
        projectedX * outputScale,
        projectedY * outputScale
      );
      soul._lastContactNormal.set(bestNormalX, bestNormalY);
      soul.surfaceSlidingThisStep = true;
      return true;
    }

    _resolveFallbackNormal(result, movementX, movementY, soul) {
      if (result.normalValid) return true;

      let normalX = 0;
      let normalY = 0;
      const movementLengthSq = movementX * movementX + movementY * movementY;

      if (movementLengthSq > ENGINE_EPSILON) {
        const inverseLength = 1 / Math.sqrt(movementLengthSq);
        normalX = -movementX * inverseLength;
        normalY = -movementY * inverseLength;
      } else {
        const cachedLengthSq = soul._lastContactNormal.lengthSq();
        if (cachedLengthSq <= ENGINE_EPSILON) return false;

        normalX = soul._lastContactNormal.x;
        normalY = soul._lastContactNormal.y;
      }

      result.normal.set(normalX, normalY);
      result.normalValid = true;
      result.correction.set(
        normalX * result.penetration,
        normalY * result.penetration
      );
      return true;
    }

    _isPositionLegalAt(
      x,
      y,
      radius,
      battleAreaWorld,
      obstacles
    ) {
      const areaDistance = battleAreaWorld.distance(x, y);
      if (
        !Number.isFinite(areaDistance) ||
        areaDistance + radius > CONTACT_SLOP
      ) {
        return false;
      }

      for (let i = 0; i < obstacles.length; i++) {
        const obstacle = obstacles[i];
        if (!CollisionSystem.canSolidCollideWithSoul(obstacle)) continue;

        const distance = obstacle.world.distance(x, y);
        if (
          !Number.isFinite(distance) ||
          radius - distance > CONTACT_SLOP
        ) {
          return false;
        }
      }

      return true;
    }

    _isPositionLegal(soul, battleAreaWorld, obstacles) {
      return this._isPositionLegalAt(
        soul.x,
        soul.y,
        soul.radius,
        battleAreaWorld,
        obstacles
      );
    }

    _syncBattleWorld(soul, battleAreaWorld) {
      const version = Number.isFinite(battleAreaWorld.version)
        ? battleAreaWorld.version
        : 0;

      if (soul._battleWorld === null) {
        soul._battleWorld = battleAreaWorld;
        soul._battleWorldVersion = version;
        return;
      }

      if (
        soul._battleWorld !== battleAreaWorld ||
        soul._battleWorldVersion !== version
      ) {
        soul.clearRecoveryAnchor();
        soul._battleWorld = battleAreaWorld;
        soul._battleWorldVersion = version;
        soul.isGrounded = false;
        soul.gravityVelocity.set(0, 0);
      }
    }

    fixedUpdate(
      soul,
      inputX,
      inputY,
      jumpDown,
      battleAreaWorld,
      obstacles = EMPTY_OBSTACLES
    ) {
      if (
        !this._validateSoulStructure(soul) ||
        !battleAreaWorld ||
        typeof battleAreaWorld.distance !== 'function' ||
        typeof battleAreaWorld.gradientTo !== 'function' ||
        !this._validateGravityBasis()
      ) {
        return false;
      }

      if (!Array.isArray(obstacles)) obstacles = EMPTY_OBSTACLES;

      const fastMode = this.movementAlgorithm === 'fast';

      soul.x = Number.isFinite(soul.x) ? soul.x : 0;
      soul.y = Number.isFinite(soul.y) ? soul.y : 0;
      soul.radius = Number.isFinite(soul.radius)
        ? Math.max(0.001, soul.radius)
        : 8;

      if (
        !this._sanitizeVector(soul.inputVelocity) ||
        !this._sanitizeVector(soul.gravityVelocity) ||
        !this._sanitizeVector(soul.externalVelocity) ||
        !this._sanitizeVector(soul._lastContactNormal)
      ) {
        return false;
      }

      const initialAreaDistance = battleAreaWorld.distance(soul.x, soul.y);
      if (!Number.isFinite(initialAreaDistance)) {
        soul.inputVelocity.set(0, 0);
        soul.gravityVelocity.set(0, 0);
        soul.externalVelocity.set(0, 0);
        soul.isGrounded = false;
        soul.surfaceSlidingThisStep = false;
        soul.gravitySlidingThisStep = false;
        soul.recoveryFailedThisStep = true;
        return false;
      }

      const speed = Number.isFinite(this.speed)
        ? Math.max(0, this.speed)
        : 180;
      const jumpForce = Number.isFinite(this.jumpForce)
        ? Math.max(0, this.jumpForce)
        : 360;
      const maxFall = Number.isFinite(this.maxFall)
        ? Math.max(0, this.maxFall)
        : 480;
      const gravityAcceleration = Number.isFinite(this.gravityAccel)
        ? Math.max(0, this.gravityAccel)
        : 1440;
      const externalDamping = Number.isFinite(this.externalDamping)
        ? Math.max(0, Math.min(1, this.externalDamping))
        : 0.9;

      const numericInputX = Number(inputX);
      const numericInputY = Number(inputY);
      inputX = Number.isFinite(numericInputX) ? numericInputX : 0;
      inputY = Number.isFinite(numericInputY) ? numericInputY : 0;
      jumpDown = Boolean(
        jumpDown === true ||
        jumpDown === 1 ||
        jumpDown === '1' ||
        jumpDown === 'true'
      );

      this._syncBattleWorld(soul, battleAreaWorld);

      soul.teleportedThisStep = false;
      soul.recoveryFailedThisStep = false;
      soul.surfaceSlidingThisStep = false;
      soul.gravitySlidingThisStep = false;

      const shouldRefreshAnchorBeforeMove =
        !fastMode || !soul._hasLastLegalPosition;
      if (
        shouldRefreshAnchorBeforeMove &&
        this._isPositionLegal(soul, battleAreaWorld, obstacles)
      ) {
        soul._lastLegalX = soul.x;
        soul._lastLegalY = soul.y;
        soul._hasLastLegalPosition = true;
      }

      soul.previousX = soul.x;
      soul.previousY = soul.y;

      if (!Number.isFinite(soul.invulnerabilityTime)) {
        soul.invulnerabilityTime = 0;
      }
      if (!Number.isFinite(soul.invulnerabilityDuration)) {
        soul.invulnerabilityDuration = 1;
      }
      soul.invulnerabilityDuration = Math.max(0, soul.invulnerabilityDuration);
      if (soul.invulnerabilityTime > 0) {
        soul.invulnerabilityTime = Math.max(
          0,
          soul.invulnerabilityTime - FIXED_DT
        );
      }

      if (soul._gravityVersion !== this.gravity.version) {
        soul.gravityVelocity.set(0, 0);
        soul._lastContactNormal.set(0, 0);
        soul.isGrounded = false;
        soul._gravityVersion = this.gravity.version;
      }

      const jumpJustPressed = jumpDown && !soul._jumpWasDown;
      soul._jumpWasDown = jumpDown;

      const gradientEpsilon = Math.max(
        0.02,
        Math.min(0.5, soul.radius * 0.05)
      );

      // 1. 速度意图 + UT 风格斜面蹭墙
      let worldInputX = inputX;
      let worldInputY = inputY;
      const worldInputLengthSq =
        worldInputX * worldInputX + worldInputY * worldInputY;
      if (worldInputLengthSq > 1) {
        const inverseLength = 1 / Math.sqrt(worldInputLengthSq);
        worldInputX *= inverseLength;
        worldInputY *= inverseLength;
      }

      const shouldProbeSurface =
        !fastMode ||
        soul.mode === 'blue' ||
        soul.isGrounded ||
        soul._lastContactNormal.lengthSq() > 0.01;
      const routedAlongSurface = shouldProbeSurface && this._tryRouteInputAlongSurface(
        soul,
        worldInputX,
        worldInputY,
        battleAreaWorld,
        obstacles,
        gradientEpsilon
      );

      if (soul.mode === 'blue') {
        if (routedAlongSurface) {
          // 蓝魂在自由空间仍只允许重力切线方向移动；只有贴面时才临时
          // 接纳上下输入，以实现 Down 顺坡下、Left 顺坡上的经典蹭墙。
          soul.inputVelocity.set(
            soul._probeResult.correction.x * speed,
            soul._probeResult.correction.y * speed
          );
        } else {
          // 运动方向投影到当前重力的切线，因此左右重力也能正确操作。
          const tangentInput = Math.max(
            -1,
            Math.min(
              1,
              worldInputX * this.gravity.tangent.x +
              worldInputY * this.gravity.tangent.y
            )
          );
          soul.inputVelocity.set(
            this.gravity.tangent.x * tangentInput * speed,
            this.gravity.tangent.y * tangentInput * speed
          );
        }

        if (!soul.isGrounded) {
          soul.gravityVelocity.x -=
            this.gravity.normal.x * gravityAcceleration * FIXED_DT;
          soul.gravityVelocity.y -=
            this.gravity.normal.y * gravityAcceleration * FIXED_DT;

          const fallVelocity = soul.gravityVelocity.dot(this.gravity.normal);
          if (fallVelocity < -maxFall) {
            soul.gravityVelocity.set(
              -this.gravity.normal.x * maxFall,
              -this.gravity.normal.y * maxFall
            );
          }
        } else if (!this._applyGroundedSlopeGravity(
          soul, gravityAcceleration, maxFall
        )) {
          soul.gravityVelocity.set(0, 0);
        }

        if (soul.isGrounded && jumpJustPressed) {
          soul.gravityVelocity.set(
            this.gravity.normal.x * jumpForce,
            this.gravity.normal.y * jumpForce
          );
          soul.isGrounded = false;
          soul.gravitySlidingThisStep = false;
        } else if (!jumpDown) {
          const upwardSpeed = soul.gravityVelocity.dot(this.gravity.normal);
          if (upwardSpeed > 0) {
            const removedSpeed = upwardSpeed - upwardSpeed * 0.8;
            soul.gravityVelocity.x -=
              this.gravity.normal.x * removedSpeed;
            soul.gravityVelocity.y -=
              this.gravity.normal.y * removedSpeed;
          }
        }
      } else {
        if (routedAlongSurface) {
          soul.inputVelocity.set(
            soul._probeResult.correction.x * speed,
            soul._probeResult.correction.y * speed
          );
        } else {
          soul.inputVelocity.set(worldInputX * speed, worldInputY * speed);
        }
        soul.gravityVelocity.set(0, 0);
      }

      // 2. 速度 -> 本固定步位移
      let remainingX =
        (soul.inputVelocity.x +
          soul.gravityVelocity.x +
          soul.externalVelocity.x) *
        FIXED_DT;
      let remainingY =
        (soul.inputVelocity.y +
          soul.gravityVelocity.y +
          soul.externalVelocity.y) *
        FIXED_DT;

      let bestGroundDot = -Infinity;
      const maxSolverIterations = fastMode ? 2 : 8;
      const maximumSubsteps = fastMode ? 4 : 128;

      // 3. 自适应子步移动（快速模式限制子步和重复投影）
      for (let iteration = 0; iteration < maxSolverIterations; iteration++) {
        const moveDistanceSq =
          remainingX * remainingX + remainingY * remainingY;
        if (moveDistanceSq < 1e-8) break;

        const moveDistance = Math.sqrt(moveDistanceSq);
        const maximumStepDistance = fastMode
          ? Math.max(2, soul.radius * 1.5)
          : Math.max(0.1, soul.radius * 0.5);
        const substeps = Math.min(
          maximumSubsteps,
          Math.max(1, Math.ceil(moveDistance / maximumStepDistance))
        );

        const stepX = remainingX / substeps;
        const stepY = remainingY / substeps;
        let collisionOccurred = false;

        for (let step = 0; step < substeps; step++) {
          soul.x += stepX;
          soul.y += stepY;
          remainingX -= stepX;
          remainingY -= stepY;

          let collided = false;
          let normalX = 0;
          let normalY = 0;

          if (
            CollisionSystem.checkCircleInsideArea(
              battleAreaWorld,
              soul.x,
              soul.y,
              soul.radius,
              soul._colResult,
              gradientEpsilon
            ) &&
            this._resolveFallbackNormal(
              soul._colResult,
              stepX,
              stepY,
              soul
            )
          ) {
            soul.x += soul._colResult.correction.x;
            soul.y += soul._colResult.correction.y;
            normalX = soul._colResult.normal.x;
            normalY = soul._colResult.normal.y;
            collided = true;
          }

          if (!collided) {
            for (let i = 0; i < obstacles.length; i++) {
              const obstacle = obstacles[i];
              if (!CollisionSystem.canSolidCollideWithSoul(obstacle)) {
                continue;
              }

              if (
                CollisionSystem.checkCircleAgainstObstacle(
                  obstacle.world,
                  soul.x,
                  soul.y,
                  soul.radius,
                  soul._colResult,
                  gradientEpsilon
                ) &&
                this._resolveFallbackNormal(
                  soul._colResult,
                  stepX,
                  stepY,
                  soul
                )
              ) {
                soul.x += soul._colResult.correction.x;
                soul.y += soul._colResult.correction.y;
                normalX = soul._colResult.normal.x;
                normalY = soul._colResult.normal.y;
                collided = true;
                break;
              }
            }
          }

          if (collided) {
            collisionOccurred = true;

            const supportDot =
              normalX * this.gravity.normal.x +
              normalY * this.gravity.normal.y;
            if (supportDot > bestGroundDot) {
              bestGroundDot = supportDot;
              soul._lastContactNormal.set(normalX, normalY);
            }

            const remainingIntoSurface =
              remainingX * normalX + remainingY * normalY;
            if (remainingIntoSurface < 0) {
              remainingX -= normalX * remainingIntoSurface;
              remainingY -= normalY * remainingIntoSurface;
            }

            this._projectVelocity(
              soul.gravityVelocity,
              soul._colResult.normal
            );
            this._projectVelocity(
              soul.inputVelocity,
              soul._colResult.normal
            );
            this._projectVelocity(
              soul.externalVelocity,
              soul._colResult.normal
            );
            break;
          }
        }

        if (!collisionOccurred) break;
      }

      // 4. 静止解重叠。快速模式只做一轮，避免复杂 CSG 每步反复采样。
      const overlapIterations = fastMode ? 1 : 4;
      for (let iteration = 0; iteration < overlapIterations; iteration++) {
        let corrected = false;

        if (
          CollisionSystem.checkCircleInsideArea(
            battleAreaWorld,
            soul.x,
            soul.y,
            soul.radius,
            soul._colResult,
            gradientEpsilon
          ) &&
          this._resolveFallbackNormal(soul._colResult, 0, 0, soul)
        ) {
          soul.x += soul._colResult.correction.x;
          soul.y += soul._colResult.correction.y;

          this._projectVelocity(
            soul.gravityVelocity,
            soul._colResult.normal
          );
          this._projectVelocity(
            soul.inputVelocity,
            soul._colResult.normal
          );
          this._projectVelocity(
            soul.externalVelocity,
            soul._colResult.normal
          );

          const supportDot = soul._colResult.normal.dot(this.gravity.normal);
          if (supportDot > bestGroundDot) {
            bestGroundDot = supportDot;
            soul._lastContactNormal.copyFrom(soul._colResult.normal);
          }
          corrected = true;
        }

        for (let i = 0; i < obstacles.length; i++) {
          const obstacle = obstacles[i];
          if (!CollisionSystem.canSolidCollideWithSoul(obstacle)) continue;

          if (
            CollisionSystem.checkCircleAgainstObstacle(
              obstacle.world,
              soul.x,
              soul.y,
              soul.radius,
              soul._colResult,
              gradientEpsilon
            ) &&
            this._resolveFallbackNormal(soul._colResult, 0, 0, soul)
          ) {
            soul.x += soul._colResult.correction.x;
            soul.y += soul._colResult.correction.y;

            this._projectVelocity(
              soul.gravityVelocity,
              soul._colResult.normal
            );
            this._projectVelocity(
              soul.inputVelocity,
              soul._colResult.normal
            );
            this._projectVelocity(
              soul.externalVelocity,
              soul._colResult.normal
            );

            const supportDot = soul._colResult.normal.dot(this.gravity.normal);
            if (supportDot > bestGroundDot) {
              bestGroundDot = supportDot;
              soul._lastContactNormal.copyFrom(soul._colResult.normal);
            }
            corrected = true;
          }
        }

        if (!corrected) break;
      }

      // 5. 合法锚点恢复
      const legalAfterResolution = this._isPositionLegal(
        soul,
        battleAreaWorld,
        obstacles
      );

      if (!legalAfterResolution && soul._hasLastLegalPosition) {
        const anchorStillLegal = this._isPositionLegalAt(
          soul._lastLegalX,
          soul._lastLegalY,
          soul.radius,
          battleAreaWorld,
          obstacles
        );

        if (anchorStillLegal) {
          soul.x = soul._lastLegalX;
          soul.y = soul._lastLegalY;
          soul.previousX = soul.x;
          soul.previousY = soul.y;
          soul.teleportedThisStep = true;
          soul.isGrounded = false;
          soul.surfaceSlidingThisStep = false;
          soul.gravitySlidingThisStep = false;

          soul.inputVelocity.set(0, 0);
          soul.gravityVelocity.set(0, 0);
          soul.externalVelocity.set(0, 0);
          soul._lastContactNormal.set(0, 0);
          bestGroundDot = -Infinity;
        } else {
          soul.clearRecoveryAnchor();
        }
      } else if (legalAfterResolution && !soul.teleportedThisStep) {
        soul._lastLegalX = soul.x;
        soul._lastLegalY = soul.y;
        soul._hasLastLegalPosition = true;
      }

      // 恢复后必须再次确认位置有效。快速模式在没有传送/恢复时复用
      // 刚得到的合法性结果，避免对复杂 CSG 再做一整轮 distance 查询。
      const legalBeforeGroundProbe = fastMode && !soul.teleportedThisStep
        ? legalAfterResolution
        : this._isPositionLegal(
            soul,
            battleAreaWorld,
            obstacles
          );

      if (!legalBeforeGroundProbe) {
        soul.inputVelocity.set(0, 0);
        soul.gravityVelocity.set(0, 0);
        soul.externalVelocity.set(0, 0);
        soul.isGrounded = false;
        soul.previousX = soul.x;
        soul.previousY = soul.y;
        soul.teleportedThisStep = true;
        soul.surfaceSlidingThisStep = false;
        soul.gravitySlidingThisStep = false;
        soul.recoveryFailedThisStep = true;
        return false;
      }

      // 6. Ground Probe
      if (soul.mode !== 'blue') {
        soul.isGrounded = false;
      } else {
        soul.isGrounded = bestGroundDot > 0.5;

        if (!soul.isGrounded) {
          const probeDistance = Math.max(
            0.05,
            Math.min(1, soul.radius * 0.1)
          );
          const probeX = soul.x - this.gravity.normal.x * probeDistance;
          const probeY = soul.y - this.gravity.normal.y * probeDistance;

          if (
            CollisionSystem.checkCircleInsideArea(
              battleAreaWorld,
              probeX,
              probeY,
              soul.radius,
              soul._probeResult,
              gradientEpsilon
            ) &&
            soul._probeResult.normalValid &&
            soul._probeResult.normal.dot(this.gravity.normal) > 0.5
          ) {
            soul.isGrounded = true;
            soul._lastContactNormal.copyFrom(soul._probeResult.normal);
          }

          if (!soul.isGrounded) {
            for (let i = 0; i < obstacles.length; i++) {
              const obstacle = obstacles[i];
              if (!CollisionSystem.canSolidCollideWithSoul(obstacle)) {
                continue;
              }

              if (
                CollisionSystem.checkCircleAgainstObstacle(
                  obstacle.world,
                  probeX,
                  probeY,
                  soul.radius,
                  soul._probeResult,
                  gradientEpsilon
                ) &&
                soul._probeResult.normalValid &&
                soul._probeResult.normal.dot(this.gravity.normal) > 0.5
              ) {
                soul.isGrounded = true;
                soul._lastContactNormal.copyFrom(soul._probeResult.normal);
                break;
              }
            }
          }
        }
      }

      // 7. 最终合法性与阻尼。Ground Probe 只读取几何，不改变位置，
      // 因此快速模式可安全复用 legalBeforeGroundProbe。
      const finalPositionLegal = fastMode
        ? legalBeforeGroundProbe
        : this._isPositionLegal(soul, battleAreaWorld, obstacles);
      if (!finalPositionLegal) {
        soul.inputVelocity.set(0, 0);
        soul.gravityVelocity.set(0, 0);
        soul.externalVelocity.set(0, 0);
        soul.isGrounded = false;
        soul.previousX = soul.x;
        soul.previousY = soul.y;
        soul.teleportedThisStep = true;
        soul.surfaceSlidingThisStep = false;
        soul.gravitySlidingThisStep = false;
        soul.recoveryFailedThisStep = true;
        return false;
      }

      soul.recoveryFailedThisStep = false;
      soul.externalVelocity.scale(externalDamping);
      return true;
    }
  }

  // ==================== 固定步时钟 ====================
  class PhysicsClock {
    constructor(controller) {
      this.controller = controller;
      this.accumulator = 0;
      this.lastTime = -1;
      this.maxFrameTime = 0.25;
      this.maxStepsPerFrame = 8;
      this.beforeFixedStep = null;
      this.afterFixedStep = null;
    }

    reset(nowMs = getNowMs()) {
      this.lastTime = Number.isFinite(nowMs) ? nowMs : getNowMs();
      this.accumulator = 0;
      return this;
    }

    tick(
      soul,
      inputX,
      inputY,
      jumpDown,
      battleAreaWorld,
      obstacles = EMPTY_OBSTACLES,
      nowMs = getNowMs()
    ) {
      return this.advance(
        soul,
        inputX,
        inputY,
        jumpDown,
        battleAreaWorld,
        obstacles,
        nowMs
      );
    }

    advance(
      soul,
      inputX,
      inputY,
      jumpDown,
      battleAreaWorld,
      obstacles = EMPTY_OBSTACLES,
      nowMs = getNowMs()
    ) {
      if (
        !this.controller ||
        typeof this.controller.fixedUpdate !== 'function'
      ) {
        this.accumulator = 0;
        return 0;
      }

      if (!Number.isFinite(nowMs)) nowMs = getNowMs();

      if (
        !Number.isFinite(this.accumulator) ||
        this.accumulator < 0
      ) {
        this.accumulator = 0;
      }

      if (!Number.isFinite(this.lastTime) || this.lastTime < 0) {
        this.lastTime = nowMs;
        return 0;
      }

      let frameTime = (nowMs - this.lastTime) / 1000;
      this.lastTime = nowMs;

      if (!Number.isFinite(frameTime) || frameTime < 0) {
        frameTime = 0;
      }

      const maximumFrameTime = Number.isFinite(this.maxFrameTime)
        ? Math.max(0, Math.min(1, this.maxFrameTime))
        : 0.25;
      const maximumStepsPerFrame = Number.isFinite(this.maxStepsPerFrame)
        ? Math.max(1, Math.min(64, Math.floor(this.maxStepsPerFrame)))
        : 8;

      frameTime = Math.min(frameTime, maximumFrameTime);
      this.accumulator += frameTime;

      let steps = 0;

      while (
        this.accumulator >= FIXED_DT &&
        steps < maximumStepsPerFrame
      ) {
        if (typeof this.beforeFixedStep === 'function') {
          this.beforeFixedStep(FIXED_DT);
        }

        const updated = this.controller.fixedUpdate(
          soul,
          inputX,
          inputY,
          jumpDown,
          battleAreaWorld,
          obstacles
        );

        // 物理步已经执行，先提交时钟状态。
        this.accumulator -= FIXED_DT;
        steps++;

        if (typeof this.afterFixedStep === 'function') {
          this.afterFixedStep(soul, FIXED_DT, updated);
        }

        if (!updated) {
          this.accumulator = 0;
          break;
        }
      }

      if (
        steps >= maximumStepsPerFrame &&
        this.accumulator >= FIXED_DT
      ) {
        this.accumulator = 0;
      }

      return steps;
    }

    getAlpha() {
      if (!Number.isFinite(this.accumulator)) return 0;
      return Math.max(0, Math.min(1, this.accumulator / FIXED_DT));
    }
  }

  // ==================== 导出 ====================
  globalEnv.UTBattleBoxEngineCore = {
    Vec2,
    Transform2D,
    SDF,
    ShapeNode,
    TransformNode,
    CSGNode,
    SDFWorld,
    CollisionResult,
    CollisionSystem,
    Hitbox,
    LayerMask,
    CollisionResponse,
    CSGType,
    AttackSystem,
    GravitySystem,
    Soul,
    SoulController,
    PhysicsClock,
    FIXED_DT,
    EMPTY_OBSTACLES,
    IS_CONFIRMED_UNSANDBOXED
  };
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * UTBattleBox V21.0 Phase 4C.16 OrganizedBlockPalette Adapter
 * 02Engine / TurboWarp Unsandboxed Extension Adapter + Native Backdrop Material Pipeline
 *
 * 提供：
 * - BattleWorld / BoxManager
 * - 主框、加框、减框 SDF/CSG 构建
 * - Solid / Trigger Hitbox 管理
 * - 自动固定步运行循环
 * - 键盘输入与手动输入
 * - 当前角色与 Soul 坐标同步
 * - 受伤与恢复失败事件帽子
 *
 * 本阶段使用 Scratch Renderer 原生 Drawable/BitmapSkin 分层，并加入后景 FBO 采样、
 * 高斯模糊与毛玻璃材质。调试信息仍可使用 DOM Canvas；正式框体不覆盖精灵。
 */
(function (globalEnv) {
  'use strict';

  const ScratchAPI = typeof Scratch !== 'undefined' ? Scratch : globalEnv.Scratch;
  if (!ScratchAPI || !ScratchAPI.extensions) {
    return;
  }

  if (ScratchAPI.extensions.unsandboxed !== true) {
    throw new Error('[UTBattleBox V21 Phase 4C.0] 必须勾选“无沙盒运行扩展”。');
  }

  if (
    globalEnv.__UTBattleBoxV21Phase4C16Registered ||
    globalEnv.__UTBattleBoxV21Phase4C13Registered ||
    globalEnv.__UTBattleBoxV21Phase4C12Registered ||
    globalEnv.__UTBattleBoxV21Phase4C11Registered ||
    globalEnv.__UTBattleBoxV21Phase4C10Registered ||
    globalEnv.__UTBattleBoxV21Phase4C9Registered ||
    globalEnv.__UTBattleBoxV21Phase4C8Registered ||
    globalEnv.__UTBattleBoxV21Phase4C7Registered ||
    globalEnv.__UTBattleBoxV21Phase4C6Registered ||
    globalEnv.__UTBattleBoxV21Phase4C5Registered ||
    globalEnv.__UTBattleBoxV21Phase4C4Registered ||
    globalEnv.__UTBattleBoxV21Phase4C3Registered ||
    globalEnv.__UTBattleBoxV21Phase4C2Registered ||
    globalEnv.__UTBattleBoxV21Phase4C1Registered ||
    globalEnv.__UTBattleBoxV21Phase4C0Registered ||
    globalEnv.__UTBattleBoxV21ExtensionRegistered ||
    globalEnv.__UTBattleBoxV21Phase4B2Registered ||
    globalEnv.__UTBattleBoxV21Phase4B3Registered ||
    globalEnv.__UTBattleBoxV21Phase4B4Registered ||
    globalEnv.__UTBattleBoxV21Phase4B7Registered ||
    globalEnv.__UTBattleBoxV21Phase4B8Registered ||
    globalEnv.__UTBattleBoxV21Phase4B9Registered
  ) {
    return;
  }

  const Core = globalEnv.UTBattleBoxEngineCore;
  if (!Core) {
    throw new Error('[UTBattleBox V21 Phase 4C.0] 未找到 Phase 3A 物理核心。');
  }

  const {
    Transform2D,
    ShapeNode,
    TransformNode,
    CSGNode,
    SDFWorld,
    Hitbox,
    LayerMask,
    CollisionResponse,
    CSGType,
    AttackSystem,
    GravitySystem,
    Soul,
    SoulController,
    PhysicsClock,
    FIXED_DT,
    EMPTY_OBSTACLES
  } = Core;

  const vm = ScratchAPI.vm;
  const runtime = vm && vm.runtime;

  // Phase 4 适配层拥有独立 IIFE，不能引用 Phase 3A IIFE 内部的同名函数。
  function getNowMs() {
    if (globalEnv.performance && typeof globalEnv.performance.now === 'function') {
      return globalEnv.performance.now();
    }
    return Date.now();
  }

  const Cast = ScratchAPI.Cast || {
    toNumber(value) {
      const number = Number(value);
      return Number.isNaN(number) ? 0 : number;
    },
    toString(value) {
      return String(value);
    },
    toBoolean(value) {
      return Boolean(value);
    }
  };

  const AreaRole = Object.freeze({
    BASE: 'base',
    ADD: 'add',
    SUBTRACT: 'subtract'
  });

  const ShapeKind = Object.freeze({
    BOX: 'box',
    CIRCLE: 'circle',
    CAPSULE: 'capsule',
    POLYGON: 'polygon'
  });

  const MAX_ABS_COORDINATE = 1000000;
  const MAX_SIZE = 1000000;
  const MAX_POLYGON_VERTICES = 256;
  const EXTENSION_ID = 'utbattlebox21';

  function finiteNumber(value, fallback = 0) {
    const number = Cast.toNumber(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function safeCoordinate(value) {
    return clamp(finiteNumber(value, 0), -MAX_ABS_COORDINATE, MAX_ABS_COORDINATE);
  }

  function safeSize(value, fallback = 1) {
    return clamp(Math.abs(finiteNumber(value, fallback)), 0.001, MAX_SIZE);
  }

  function safeScale(value) {
    const scale = finiteNumber(value, 1);
    if (Math.abs(scale) < 0.000001) return scale < 0 ? -0.000001 : 0.000001;
    return clamp(scale, -10000, 10000);
  }

  function safeId(value) {
    const id = Cast.toString(value).trim();
    return id || 'unnamed';
  }

  function degreesToRadians(value) {
    return finiteNumber(value, 0) * Math.PI / 180;
  }

  function parseOnOff(value) {
    const text = Cast.toString(value).toLowerCase();
    return text === 'on' || text === 'true' || text === '1' || text === '开启';
  }


  // Camera V2 stores its logical camera state on each Drawable under a private Symbol.
  // The Symbol itself is local to that extension, but its value shape is stable enough to
  // detect without depending on the extension ID or load order.
  const CAMERA_V2_STATE_CACHE = typeof WeakMap === 'function' ? new WeakMap() : null;

  function isCameraV2State(value) {
    return Boolean(
      value && typeof value === 'object' &&
      typeof value.name === 'string' &&
      Array.isArray(value.ogXY) && value.ogXY.length >= 2 &&
      Number.isFinite(value.ogSZ) && Number.isFinite(value.ogDir)
    );
  }

  function findCameraV2State(drawable) {
    if (!drawable || typeof drawable !== 'object') return null;
    if (CAMERA_V2_STATE_CACHE) {
      const cached = CAMERA_V2_STATE_CACHE.get(drawable);
      if (cached && cached.symbol) {
        let current = null;
        try { current = drawable[cached.symbol]; } catch (error) { current = null; }
        if (isCameraV2State(current)) {
          if (current !== cached.value) CAMERA_V2_STATE_CACHE.set(drawable, {symbol: cached.symbol, value: current});
          return current;
        }
      }
    }
    let symbols;
    try {
      symbols = Object.getOwnPropertySymbols(drawable);
    } catch (error) {
      return null;
    }
    for (let i = 0; i < symbols.length; i++) {
      let value;
      try { value = drawable[symbols[i]]; } catch (error) { value = null; }
      if (!isCameraV2State(value)) continue;
      if (CAMERA_V2_STATE_CACHE) CAMERA_V2_STATE_CACHE.set(drawable, {symbol: symbols[i], value});
      return value;
    }
    if (CAMERA_V2_STATE_CACHE) CAMERA_V2_STATE_CACHE.set(drawable, {symbol: null, value: null});
    return null;
  }

  function readCameraV2Zoom(drawable) {
    const state = findCameraV2State(drawable);
    if (state && Number.isFinite(state.ogSZ)) return state.ogSZ;
    return NaN;
  }

  function isArrayLikeVector(value) {
    return Boolean(
      value && typeof value === 'object' &&
      Number.isFinite(value.length) && value.length >= 2 &&
      (Array.isArray(value) || (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)))
    );
  }

  function readDrawableScale(drawable) {
    if (!drawable) return null;
    const scale = isArrayLikeVector(drawable._scale)
      ? drawable._scale
      : (isArrayLikeVector(drawable.scale) ? drawable.scale : null);
    return scale && Number.isFinite(Number(scale[0])) && Number.isFinite(Number(scale[1]))
      ? scale
      : null;
  }

  // Pixel-art souls are especially sensitive to Camera V2's non-integer zoom levels.
  // Scratch's SVG renderer normally uses nearest-neighbour only around 100% scale.
  // This registry overrides Skin.useNearest only for the bound soul Drawable, leaving
  // every other sprite/clone using the renderer's original sampling policy.
  const SOUL_PIXEL_SAMPLING_PATCH = typeof Symbol === 'function'
    ? Symbol('UTBattleBoxSoulPixelSamplingPatch')
    : '__UTBattleBoxSoulPixelSamplingPatch';

  function installSoulPixelSampling(drawable) {
    if (!drawable || !drawable.skin || !Number.isFinite(drawable._id)) return null;
    const skin = drawable.skin;
    let patch = skin[SOUL_PIXEL_SAMPLING_PATCH];
    if (!patch) {
      const original = typeof skin.useNearest === 'function'
        ? skin.useNearest
        : function () { return false; };
      patch = {original, drawableIds: new Set()};
      try {
        Object.defineProperty(skin, SOUL_PIXEL_SAMPLING_PATCH, {
          value: patch,
          configurable: true
        });
      } catch (error) {
        skin[SOUL_PIXEL_SAMPLING_PATCH] = patch;
      }
      skin.useNearest = function (scale, candidateDrawable) {
        const candidateId = candidateDrawable && Number.isFinite(candidateDrawable._id)
          ? candidateDrawable._id
          : (candidateDrawable && Number.isFinite(candidateDrawable.id) ? candidateDrawable.id : NaN);
        if (Number.isFinite(candidateId) && patch.drawableIds.has(candidateId)) return true;
        // Some scratch-render builds call Skin.useNearest(scale) without passing the
        // Drawable. While the bound soul uses this skin, prefer nearest-neighbour in
        // that legacy signature too. This can also affect clones sharing the same skin,
        // but avoids fractional-zoom outline pulsation on those hosts.
        if (!candidateDrawable && patch.drawableIds.size > 0) return true;
        return patch.original.call(this, scale, candidateDrawable);
      };
    }
    patch.drawableIds.add(drawable._id);
    return {skin, drawableId: drawable._id};
  }

  function removeSoulPixelSampling(binding) {
    if (!binding || !binding.skin) return;
    const skin = binding.skin;
    const patch = skin[SOUL_PIXEL_SAMPLING_PATCH];
    if (!patch) return;
    patch.drawableIds.delete(binding.drawableId);
    if (patch.drawableIds.size === 0) {
      skin.useNearest = patch.original;
      try { delete skin[SOUL_PIXEL_SAMPLING_PATCH]; } catch (error) { /* ignored */ }
    }
  }


  function getRendererPhysicalPixelGrid(renderer) {
    if (!renderer) return {stepX: 1, stepY: 1, ratioX: 1, ratioY: 1};
    const canvas = renderer._gl && renderer._gl.canvas
      ? renderer._gl.canvas
      : (renderer.canvas || null);
    let nativeWidth = 480;
    let nativeHeight = 360;
    try {
      const nativeSize = typeof renderer.getNativeSize === 'function'
        ? renderer.getNativeSize()
        : renderer._nativeSize;
      if (nativeSize && Number.isFinite(Number(nativeSize[0])) && Math.abs(Number(nativeSize[0])) > 0) {
        nativeWidth = Math.abs(Number(nativeSize[0]));
      }
      if (nativeSize && Number.isFinite(Number(nativeSize[1])) && Math.abs(Number(nativeSize[1])) > 0) {
        nativeHeight = Math.abs(Number(nativeSize[1]));
      }
    } catch (error) { /* use defaults */ }
    const canvasWidth = canvas && Number.isFinite(Number(canvas.width)) && Number(canvas.width) > 0
      ? Number(canvas.width)
      : nativeWidth;
    const canvasHeight = canvas && Number.isFinite(Number(canvas.height)) && Number(canvas.height) > 0
      ? Number(canvas.height)
      : nativeHeight;
    const ratioX = Math.max(0.000001, canvasWidth / nativeWidth);
    const ratioY = Math.max(0.000001, canvasHeight / nativeHeight);
    return {
      stepX: 1 / ratioX,
      stepY: 1 / ratioY,
      ratioX,
      ratioY
    };
  }

  // Camera V2 forward position transform:
  // screen = zoom * R(dir) * (world + cameraXY)
  //
  // At fractional zoom, a tiny pixel-art soul can land between physical pixels. Its
  // rasterized width then alternates by one pixel as it moves, which looks like the
  // sprite is repeatedly changing size even though Drawable._scale is correct.
  // Snap only the rendered center to the physical pixel grid, then invert the camera
  // transform and submit that adjusted WORLD position through Camera V2's own wrapper.
  function snapCameraV2WorldPosition(renderer, cameraState, worldX, worldY) {
    if (!cameraState || cameraState.needsRefresh === true) return null;
    const zoom = Number(cameraState.ogSZ);
    const cameraX = Number(cameraState.ogXY && cameraState.ogXY[0]);
    const cameraY = Number(cameraState.ogXY && cameraState.ogXY[1]);
    const direction = Number(cameraState.ogDir);
    if (
      !Number.isFinite(zoom) || Math.abs(zoom) < 0.000001 ||
      !Number.isFinite(cameraX) || !Number.isFinite(cameraY) ||
      !Number.isFinite(direction) ||
      !Number.isFinite(worldX) || !Number.isFinite(worldY)
    ) return null;

    const radians = direction * Math.PI / 180;
    const sin = Math.sin(radians);
    const cos = Math.cos(radians);
    const offsetX = worldX + cameraX;
    const offsetY = worldY + cameraY;
    const screenX = zoom * (offsetX * cos - offsetY * sin);
    const screenY = zoom * (offsetX * sin + offsetY * cos);
    const grid = getRendererPhysicalPixelGrid(renderer);
    const snappedScreenX = Math.round(screenX / grid.stepX) * grid.stepX;
    const snappedScreenY = Math.round(screenY / grid.stepY) * grid.stepY;

    const scaledX = snappedScreenX / zoom;
    const scaledY = snappedScreenY / zoom;
    const inverseX = scaledX * cos + scaledY * sin;
    const inverseY = -scaledX * sin + scaledY * cos;
    const snappedWorldX = inverseX - cameraX;
    const snappedWorldY = inverseY - cameraY;
    if (!Number.isFinite(snappedWorldX) || !Number.isFinite(snappedWorldY)) return null;
    return {
      worldX: snappedWorldX,
      worldY: snappedWorldY,
      screenX: snappedScreenX,
      screenY: snappedScreenY,
      rawScreenX: screenX,
      rawScreenY: screenY,
      ratioX: grid.ratioX,
      ratioY: grid.ratioY
    };
  }


  // Camera V2 calls drawable.updateScale(drawable._scale) while refreshing a camera.
  // Its wrapper mutates the provided array in place before forwarding it. Passing the
  // Drawable's own internal array through multiple wrappers can expose a partially updated
  // scale to other extensions. This guard clones only that refresh input.
  function ensureCameraV2ScaleCopyGuard(renderer) {
    // Camera V2 exclusively owns sprite direction/scale. This compatibility entry
    // intentionally performs no patching and remains only for legacy diagnostics.
    return false;
  }

  function parseAreaRole(value) {
    const text = Cast.toString(value).toLowerCase();
    if (text === AreaRole.ADD || text === 'add' || text === '加框') return AreaRole.ADD;
    if (text === AreaRole.SUBTRACT || text === 'subtract' || text === '减框') return AreaRole.SUBTRACT;
    return AreaRole.BASE;
  }

  function parseResponse(value) {
    const text = Cast.toString(value).toLowerCase();
    if (text === 'solid' || text === '实体') return CollisionResponse.SOLID;
    if (text === 'both' || text === 'solid_and_trigger' || text === '实体并触发') {
      return CollisionResponse.SOLID_AND_TRIGGER;
    }
    return CollisionResponse.TRIGGER;
  }

  function parseLayer(value) {
    const text = Cast.toString(value).toLowerCase();
    if (text === 'laser' || text === '激光') return LayerMask.LASER;
    if (text === 'safe' || text === '安全') return LayerMask.SAFE;
    return LayerMask.BULLET;
  }

  function parsePolygonPoints(value) {
    const text = Cast.toString(value).trim();
    if (!text) return null;

    const rawPairs = text.split(/[;\s]+/);
    const vertices = [];

    for (let i = 0; i < rawPairs.length && vertices.length < MAX_POLYGON_VERTICES; i++) {
      const pair = rawPairs[i].split(',');
      if (pair.length !== 2) continue;
      const x = Number(pair[0]);
      const y = Number(pair[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      vertices.push({
        x: clamp(x, -MAX_ABS_COORDINATE, MAX_ABS_COORDINATE),
        y: clamp(y, -MAX_ABS_COORDINATE, MAX_ABS_COORDINATE)
      });
    }

    return vertices.length >= 3 ? vertices : null;
  }

  class BattleWorldManager {
    constructor() {
      this.areaWorld = new SDFWorld(null);
      this.areaRecords = new Map();
      this.hitboxRecords = new Map();
      this.solidHitboxes = [];
      this.triggerHitboxes = [];
      this.collisionVersion = 0;
    }

    clear() {
      this.areaRecords.clear();
      this.hitboxRecords.clear();
      this.solidHitboxes.length = 0;
      this.triggerHitboxes.length = 0;
      this.areaWorld.setRoot(null);
      this.areaWorld.touch();
      this.collisionVersion++;
    }

    _createTransformNode(shape, x, y, rotationDegrees = 0, scaleX = 1, scaleY = 1) {
      const transform = new Transform2D(
        safeCoordinate(x),
        safeCoordinate(y),
        degreesToRadians(rotationDegrees),
        safeScale(scaleX),
        safeScale(scaleY)
      );
      return {
        transform,
        node: new TransformNode(shape, transform)
      };
    }

    _removeExisting(id) {
      let changed = false;
      if (this.areaRecords.delete(id)) changed = true;
      if (this.hitboxRecords.delete(id)) changed = true;
      return changed;
    }

    _setAreaRecord(idValue, roleValue, kind, shape, x, y, rotation = 0) {
      const id = safeId(idValue);
      this._removeExisting(id);
      const transformed = this._createTransformNode(shape, x, y, rotation, 1, 1);
      this.areaRecords.set(id, {
        id,
        category: 'area',
        role: parseAreaRole(roleValue),
        kind,
        shape,
        transform: transformed.transform,
        node: transformed.node,
        enabled: true
      });
      this._rebuildArea();
      this._rebuildHitboxCaches();
      return id;
    }

    setAreaBox(id, role, x, y, width, height, roundness) {
      const halfWidth = safeSize(width, 100) * 0.5;
      const halfHeight = safeSize(height, 100) * 0.5;
      const radius = clamp(Math.abs(finiteNumber(roundness, 0)), 0, Math.min(halfWidth, halfHeight));
      return this._setAreaRecord(
        id,
        role,
        ShapeKind.BOX,
        new ShapeNode('box', {h: {x: halfWidth, y: halfHeight}, r: radius}),
        x,
        y,
        0
      );
    }

    getAreaBoxState(idValue) {
      const record = this.areaRecords.get(safeId(idValue));
      if (!record || record.kind !== ShapeKind.BOX || !record.shape || !record.transform) return null;
      const params = record.shape.params || {};
      const half = params.h;
      if (!half || !Number.isFinite(half.x) || !Number.isFinite(half.y)) return null;
      return {
        x: record.transform.pos.x,
        y: record.transform.pos.y,
        width: Math.max(0.001, half.x * 2),
        height: Math.max(0.001, half.y * 2),
        roundness: Math.max(0, finiteNumber(params.r, 0)),
        rotation: record.transform.rotation * 180 / Math.PI
      };
    }

    applyAreaBoxStateValues(idValue, x, y, widthValue, heightValue, roundnessValue, rotationValue, bumpVersion = true) {
      const record = this.areaRecords.get(safeId(idValue));
      if (!record || record.kind !== ShapeKind.BOX || !record.shape || !record.transform) {
        this._lastAreaBoxStateChanged = false;
        return false;
      }
      const width = clamp(finiteNumber(widthValue, record.shape.params.h.x * 2), 0.001, MAX_SIZE);
      const height = clamp(finiteNumber(heightValue, record.shape.params.h.y * 2), 0.001, MAX_SIZE);
      const halfWidth = width * 0.5;
      const halfHeight = height * 0.5;
      const roundness = clamp(
        Math.abs(finiteNumber(roundnessValue, record.shape.params.r)),
        0,
        Math.min(halfWidth, halfHeight)
      );
      const nextX = safeCoordinate(x);
      const nextY = safeCoordinate(y);
      const nextRotation = degreesToRadians(rotationValue);
      const half = record.shape.params.h;
      const changed =
        Math.abs(half.x - halfWidth) > 1e-7 ||
        Math.abs(half.y - halfHeight) > 1e-7 ||
        Math.abs(record.shape.params.r - roundness) > 1e-7 ||
        Math.abs(record.transform.pos.x - nextX) > 1e-7 ||
        Math.abs(record.transform.pos.y - nextY) > 1e-7 ||
        Math.abs(record.transform.rotation - nextRotation) > 1e-9;
      this._lastAreaBoxStateChanged = changed;
      if (!changed) return true;
      half.set(halfWidth, halfHeight);
      record.shape.params.r = roundness;
      record.transform.setPosition(nextX, nextY);
      record.transform.setRotation(nextRotation);
      if (bumpVersion) this.collisionVersion++;
      return true;
    }

    applyAreaBoxState(idValue, state) {
      const record = this.areaRecords.get(safeId(idValue));
      if (!record || record.kind !== ShapeKind.BOX || !record.shape || !record.transform) return false;
      const source = state && typeof state === 'object' ? state : {};
      return this.applyAreaBoxStateValues(
        idValue,
        Object.prototype.hasOwnProperty.call(source, 'x') ? source.x : record.transform.pos.x,
        Object.prototype.hasOwnProperty.call(source, 'y') ? source.y : record.transform.pos.y,
        Object.prototype.hasOwnProperty.call(source, 'width') ? source.width : record.shape.params.h.x * 2,
        Object.prototype.hasOwnProperty.call(source, 'height') ? source.height : record.shape.params.h.y * 2,
        Object.prototype.hasOwnProperty.call(source, 'roundness') ? source.roundness : record.shape.params.r,
        Object.prototype.hasOwnProperty.call(source, 'rotation') ? source.rotation : record.transform.rotation * 180 / Math.PI,
        true
      );
    }

    touchGeometry() {
      this.collisionVersion++;
      return this.collisionVersion;
    }

    setAreaCircle(id, role, x, y, radius) {
      return this._setAreaRecord(
        id,
        role,
        ShapeKind.CIRCLE,
        new ShapeNode('circle', {r: safeSize(radius, 50)}),
        x,
        y,
        0
      );
    }

    setAreaCapsule(id, role, x, y, halfHeight, radius, rotation) {
      return this._setAreaRecord(
        id,
        role,
        ShapeKind.CAPSULE,
        new ShapeNode('capsule', {
          hh: safeSize(halfHeight, 50),
          r: safeSize(radius, 20)
        }),
        x,
        y,
        rotation
      );
    }

    setAreaPolygon(id, role, x, y, points, rotation) {
      const vertices = parsePolygonPoints(points);
      if (!vertices) {
        throw new Error('多边形至少需要三个有效顶点，格式示例：0,50 50,-40 -50,-40');
      }
      return this._setAreaRecord(
        id,
        role,
        ShapeKind.POLYGON,
        new ShapeNode('polygon', {vertices}),
        x,
        y,
        rotation
      );
    }

    _setHitboxRecord(idValue, responseValue, layerValue, damage, shape, x, y, rotation = 0) {
      const id = safeId(idValue);
      this._removeExisting(id);
      const transformed = this._createTransformNode(shape, x, y, rotation, 1, 1);
      const hitbox = new Hitbox(
        id,
        transformed.node,
        Math.max(0, finiteNumber(damage, 10)),
        parseLayer(layerValue),
        LayerMask.SOUL,
        parseResponse(responseValue)
      );
      this.hitboxRecords.set(id, {
        id,
        category: 'hitbox',
        shape,
        transform: transformed.transform,
        node: transformed.node,
        hitbox,
        enabled: true
      });
      this._rebuildArea();
      this._rebuildHitboxCaches();
      this.collisionVersion++;
      return id;
    }

    setHitboxBox(id, response, layer, damage, x, y, width, height, roundness, rotation) {
      const halfWidth = safeSize(width, 40) * 0.5;
      const halfHeight = safeSize(height, 40) * 0.5;
      const radius = clamp(Math.abs(finiteNumber(roundness, 0)), 0, Math.min(halfWidth, halfHeight));
      return this._setHitboxRecord(
        id,
        response,
        layer,
        damage,
        new ShapeNode('box', {h: {x: halfWidth, y: halfHeight}, r: radius}),
        x,
        y,
        rotation
      );
    }

    setHitboxCircle(id, response, layer, damage, x, y, radius) {
      return this._setHitboxRecord(
        id,
        response,
        layer,
        damage,
        new ShapeNode('circle', {r: safeSize(radius, 10)}),
        x,
        y,
        0
      );
    }

    setHitboxCapsule(id, response, layer, damage, x, y, halfHeight, radius, rotation) {
      return this._setHitboxRecord(
        id,
        response,
        layer,
        damage,
        new ShapeNode('capsule', {
          hh: safeSize(halfHeight, 20),
          r: safeSize(radius, 8)
        }),
        x,
        y,
        rotation
      );
    }

    deleteObject(idValue) {
      const id = safeId(idValue);
      const changed = this._removeExisting(id);
      if (changed) {
        this._rebuildArea();
        this._rebuildHitboxCaches();
        this.collisionVersion++;
      }
      return changed;
    }

    setObjectEnabled(idValue, enabled) {
      const id = safeId(idValue);
      const area = this.areaRecords.get(id);
      if (area) {
        area.enabled = Boolean(enabled);
        this._rebuildArea();
        this.collisionVersion++;
        return true;
      }
      const record = this.hitboxRecords.get(id);
      if (record) {
        record.enabled = Boolean(enabled);
        record.hitbox.enabled = record.enabled;
        this._rebuildHitboxCaches();
        this.collisionVersion++;
        return true;
      }
      return false;
    }

    setObjectTransform(idValue, x, y, rotation, scaleX, scaleY) {
      const id = safeId(idValue);
      const record = this.areaRecords.get(id) || this.hitboxRecords.get(id);
      if (!record || !record.transform) return false;
      record.transform.setPosition(safeCoordinate(x), safeCoordinate(y));
      record.transform.setRotation(degreesToRadians(rotation));
      record.transform.setScale(safeScale(scaleX), safeScale(scaleY));
      if (record.category === 'area') {
        this.areaWorld.touch();
      } else if (record.hitbox && record.hitbox.world) {
        record.hitbox.world.touch();
      }
      this.collisionVersion++;
      return true;
    }

    setHitboxDamage(idValue, damage) {
      const record = this.hitboxRecords.get(safeId(idValue));
      if (!record) return false;
      record.hitbox.damage = Math.max(0, finiteNumber(damage, 0));
      return true;
    }

    _rebuildArea() {
      const positiveNodes = [];
      const subtractNodes = [];

      for (const record of this.areaRecords.values()) {
        if (!record.enabled) continue;
        if (record.role === AreaRole.SUBTRACT) subtractNodes.push(record.node);
        else positiveNodes.push(record.node);
      }

      if (positiveNodes.length === 0) {
        this.areaWorld.setRoot(null);
        this.areaWorld.touch();
        return;
      }

      const positiveRoot = positiveNodes.length === 1
        ? positiveNodes[0]
        : new CSGNode(CSGType.UNION, positiveNodes);

      const root = subtractNodes.length === 0
        ? positiveRoot
        : new CSGNode(CSGType.SUBTRACT, [positiveRoot].concat(subtractNodes));

      this.areaWorld.setRoot(root);
      this.areaWorld.touch();
      this.collisionVersion++;
    }

    _rebuildHitboxCaches() {
      this.solidHitboxes.length = 0;
      this.triggerHitboxes.length = 0;

      for (const record of this.hitboxRecords.values()) {
        const hitbox = record.hitbox;
        hitbox.enabled = Boolean(record.enabled);
        if (!hitbox.enabled) continue;
        if (hitbox.isSolid()) this.solidHitboxes.push(hitbox);
        if (hitbox.isTrigger()) this.triggerHitboxes.push(hitbox);
      }
    }

    hasObject(idValue) {
      const id = safeId(idValue);
      return this.areaRecords.has(id) || this.hitboxRecords.has(id);
    }

    getObjectCount() {
      return this.areaRecords.size + this.hitboxRecords.size;
    }

    isCircleLegal(x, y, radius) {
      if (!this.areaWorld.root) return false;
      const safeRadius = Math.max(0.001, finiteNumber(radius, 8));
      const areaDistance = this.areaWorld.distance(x, y);
      if (!Number.isFinite(areaDistance) || areaDistance + safeRadius > 0.0001) return false;

      for (let i = 0; i < this.solidHitboxes.length; i++) {
        const hitbox = this.solidHitboxes[i];
        if (!hitbox.enabled) continue;
        const distance = hitbox.world.distance(x, y);
        if (!Number.isFinite(distance) || safeRadius - distance > 0.0001) return false;
      }
      return true;
    }
  }


  // ==================== Phase 4C.0 框体 Tween / Easing 系统 ====================
  const TweenConflictMode = Object.freeze({
    REPLACE: 'replace',
    QUEUE: 'queue',
    IGNORE: 'ignore'
  });

  function normalizeTweenConflict(value) {
    const text = Cast.toString(value).toLowerCase();
    if (text === 'queue' || text === '排队') return TweenConflictMode.QUEUE;
    if (text === 'ignore' || text === '忽略新过渡') return TweenConflictMode.IGNORE;
    return TweenConflictMode.REPLACE;
  }

  function normalizeEaseDirection(value) {
    const text = Cast.toString(value).toLowerCase();
    if (text === 'in' || text === '缓入') return 'in';
    if (text === 'inout' || text === 'in-out' || text === '缓入缓出' || text === '缓出入') return 'inOut';
    return 'out';
  }

  function normalizeEaseFamily(value) {
    const text = Cast.toString(value).toLowerCase();
    const aliases = {
      '线性': 'linear', linear: 'linear',
      '平滑步': 'smoothstep', smoothstep: 'smoothstep',
      '更平滑步': 'smootherstep', smootherstep: 'smootherstep',
      '二次': 'quad', quad: 'quad', quadratic: 'quad',
      '三次': 'cubic', cubic: 'cubic',
      '四次': 'quart', quart: 'quart', quartic: 'quart',
      '五次': 'quint', quint: 'quint', quintic: 'quint',
      '正弦': 'sine', sine: 'sine',
      '指数': 'expo', expo: 'expo', exponential: 'expo',
      '圆形': 'circ', circ: 'circ', circular: 'circ',
      '回退': 'back', back: 'back',
      '弹性': 'elastic', elastic: 'elastic',
      '弹跳': 'bounce', bounce: 'bounce',
      '柔和弹簧': 'springSoft', '弹簧柔和': 'springSoft', springsoft: 'springSoft',
      '标准弹簧': 'spring', '弹簧标准': 'spring', spring: 'spring',
      '强烈弹簧': 'springStrong', '弹簧强烈': 'springStrong', springstrong: 'springStrong'
    };
    return aliases[text] || 'cubic';
  }

  function bounceOut(t) {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) {
      t -= 1.5 / d1;
      return n1 * t * t + 0.75;
    }
    if (t < 2.5 / d1) {
      t -= 2.25 / d1;
      return n1 * t * t + 0.9375;
    }
    t -= 2.625 / d1;
    return n1 * t * t + 0.984375;
  }

  function easeInFamily(family, t) {
    switch (family) {
      case 'linear': return t;
      case 'smoothstep': return t * t * (3 - 2 * t);
      case 'smootherstep': return t * t * t * (t * (t * 6 - 15) + 10);
      case 'quad': return t * t;
      case 'cubic': return t * t * t;
      case 'quart': return t * t * t * t;
      case 'quint': return t * t * t * t * t;
      case 'sine': return 1 - Math.cos((t * Math.PI) / 2);
      case 'expo': return t <= 0 ? 0 : Math.pow(2, 10 * t - 10);
      case 'circ': return 1 - Math.sqrt(Math.max(0, 1 - t * t));
      case 'back': {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return c3 * t * t * t - c1 * t * t;
      }
      case 'elastic': {
        if (t <= 0 || t >= 1) return t;
        const c4 = (2 * Math.PI) / 3;
        return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
      }
      case 'bounce': return 1 - bounceOut(1 - t);
      default: return t;
    }
  }

  function springOut(t, damping, oscillations) {
    if (t <= 0 || t >= 1) return t;
    return 1 - Math.exp(-damping * t) * Math.cos(oscillations * Math.PI * t);
  }

  function evaluateEase(familyValue, directionValue, progress) {
    const family = normalizeEaseFamily(familyValue);
    const direction = normalizeEaseDirection(directionValue);
    const t = clamp(progress, 0, 1);
    if (t <= 0 || t >= 1) return t;

    if (family === 'springSoft' || family === 'spring' || family === 'springStrong') {
      const damping = family === 'springSoft' ? 5.5 : (family === 'springStrong' ? 10 : 7.5);
      const oscillations = family === 'springSoft' ? 3 : (family === 'springStrong' ? 7 : 5);
      if (direction === 'in') return 1 - springOut(1 - t, damping, oscillations);
      if (direction === 'inOut') {
        return t < 0.5
          ? (1 - springOut(1 - t * 2, damping, oscillations)) * 0.5
          : 0.5 + springOut(t * 2 - 1, damping, oscillations) * 0.5;
      }
      return springOut(t, damping, oscillations);
    }

    if (family === 'linear' || family === 'smoothstep' || family === 'smootherstep') {
      return easeInFamily(family, t);
    }
    if (direction === 'in') return easeInFamily(family, t);
    if (direction === 'inOut') {
      return t < 0.5
        ? easeInFamily(family, t * 2) * 0.5
        : 1 - easeInFamily(family, (1 - t) * 2) * 0.5;
    }
    return 1 - easeInFamily(family, 1 - t);
  }

  function easeFamilyName(value) {
    const names = {
      linear: '线性', smoothstep: '平滑步', smootherstep: '更平滑步',
      quad: '二次', cubic: '三次', quart: '四次', quint: '五次',
      sine: '正弦', expo: '指数', circ: '圆形', back: '回退',
      elastic: '弹性', bounce: '弹跳', springSoft: '柔和弹簧',
      spring: '标准弹簧', springStrong: '强烈弹簧'
    };
    return names[normalizeEaseFamily(value)] || '三次';
  }

  function easeDirectionName(value) {
    const direction = normalizeEaseDirection(value);
    return direction === 'in' ? '缓入' : (direction === 'inOut' ? '缓出入' : '缓出');
  }

  class BoxTweenSystem {
    constructor(manager, onComplete) {
      this.manager = manager;
      this.onComplete = typeof onComplete === 'function' ? onComplete : null;
      this.active = new Map();
      this.paused = false;
    }

    clear() {
      this.active.clear();
      this.paused = false;
    }

    hasActiveTweens() {
      return this.active.size > 0;
    }

    _sanitizeTarget(current, target) {
      const source = target && typeof target === 'object' ? target : {};
      const has = (key) => Object.prototype.hasOwnProperty.call(source, key);
      const width = has('width') ? safeSize(source.width, current.width) : current.width;
      const height = has('height') ? safeSize(source.height, current.height) : current.height;
      return {
        x: has('x') ? safeCoordinate(source.x) : current.x,
        y: has('y') ? safeCoordinate(source.y) : current.y,
        width,
        height,
        roundness: clamp(
          Math.abs(has('roundness') ? finiteNumber(source.roundness, current.roundness) : current.roundness),
          0,
          Math.min(width, height) * 0.5
        ),
        rotation: has('rotation') ? finiteNumber(source.rotation, current.rotation) : current.rotation
      };
    }

    _begin(id, descriptor, queue) {
      const current = this.manager.getAreaBoxState(id);
      if (!current) return false;
      const target = this._sanitizeTarget(current, descriptor.target);
      const duration = Math.max(0, finiteNumber(descriptor.duration, 0));
      if (duration <= 0) {
        this.manager.applyAreaBoxState(id, target);
        if (this.onComplete) this.onComplete(id);
        if (queue && queue.length > 0) {
          const next = queue.shift();
          return this._begin(id, next, queue);
        }
        this.active.delete(id);
        return true;
      }
      this.active.set(id, {
        id,
        start: current,
        target,
        duration,
        elapsed: 0,
        family: normalizeEaseFamily(descriptor.family),
        direction: normalizeEaseDirection(descriptor.direction),
        queue: queue || []
      });
      return true;
    }

    start(idValue, target, duration, family, direction, conflictValue) {
      const id = safeId(idValue);
      if (!this.manager.getAreaBoxState(id)) return false;
      const descriptor = {target, duration, family, direction};
      const conflict = normalizeTweenConflict(conflictValue);
      const existing = this.active.get(id);
      if (existing) {
        if (conflict === TweenConflictMode.IGNORE) return true;
        if (conflict === TweenConflictMode.QUEUE) {
          existing.queue.push(descriptor);
          return true;
        }
        this.active.delete(id);
      }
      return this._begin(id, descriptor, []);
    }

    stop(idValue) {
      return this.active.delete(safeId(idValue));
    }

    stopAll() {
      const hadAny = this.active.size > 0;
      this.active.clear();
      return hadAny;
    }

    finish(idValue) {
      const id = safeId(idValue);
      const task = this.active.get(id);
      if (!task) return false;
      this.manager.applyAreaBoxState(id, task.target);
      const queue = task.queue;
      this.active.delete(id);
      if (this.onComplete) this.onComplete(id);
      if (queue.length > 0) {
        const next = queue.shift();
        this._begin(id, next, queue);
      }
      return true;
    }

    update(deltaSeconds) {
      if (this.paused || this.active.size === 0) return false;
      const dt = Math.max(0, Math.min(0.25, finiteNumber(deltaSeconds, 0)));
      if (dt <= 0) return false;
      let changed = false;
      for (const [id, task] of this.active) {
        if (!task) continue;
        task.elapsed = Math.min(task.duration, task.elapsed + dt);
        const progress = task.duration > 0 ? task.elapsed / task.duration : 1;
        const eased = progress >= 1 ? 1 : evaluateEase(task.family, task.direction, progress);
        const x = task.start.x + (task.target.x - task.start.x) * eased;
        const y = task.start.y + (task.target.y - task.start.y) * eased;
        const width = task.start.width + (task.target.width - task.start.width) * eased;
        const height = task.start.height + (task.target.height - task.start.height) * eased;
        const roundness = task.start.roundness + (task.target.roundness - task.start.roundness) * eased;
        const rotation = task.start.rotation + (task.target.rotation - task.start.rotation) * eased;
        if (!this.manager.applyAreaBoxStateValues(id, x, y, width, height, roundness, rotation, false)) {
          this.active.delete(id);
          continue;
        }
        if (this.manager._lastAreaBoxStateChanged) changed = true;
        if (progress >= 1) {
          const queue = task.queue;
          this.active.delete(id);
          if (this.onComplete) this.onComplete(id);
          if (queue.length > 0) {
            const next = queue.shift();
            this._begin(id, next, queue);
          }
        }
      }
      if (changed && this.manager && typeof this.manager.touchGeometry === 'function') {
        this.manager.touchGeometry();
      }
      return changed;
    }

    isTweening(idValue) {
      return this.active.has(safeId(idValue));
    }

    getProgress(idValue) {
      const task = this.active.get(safeId(idValue));
      if (!task || task.duration <= 0) return 0;
      return clamp(task.elapsed / task.duration, 0, 1);
    }

    getCurveName(idValue) {
      const task = this.active.get(safeId(idValue));
      if (!task) return '';
      return `${easeFamilyName(task.family)} ${easeDirectionName(task.direction)}`;
    }
  }


  const PerformanceMode = Object.freeze({
    AUTO: 'auto',
    QUALITY: 'quality',
    BALANCED: 'balanced',
    PERFORMANCE: 'performance',
    BATTERY: 'battery'
  });

  const PERFORMANCE_CONFIGS = Object.freeze({
    quality: Object.freeze({
      key: 'quality', name: '高画质', renderFps: 60, cameraPollMs: 16,
      maintenanceMs: 50, idlePollMs: 50, maxTextureScale: 4,
      animationTextureScale: 1, materialHzCap: 30, animationMaterialHzCap: 8, captureScale: 1,
      proxyCapturesPerFrame: 2, cropOverscan: 24, useCanvasFilterBlur: false,
      borderRings: 1, borderDirections: 1, borderDirectionCap: 1
    }),
    balanced: Object.freeze({
      key: 'balanced', name: '均衡', renderFps: 50, cameraPollMs: 33,
      maintenanceMs: 100, idlePollMs: 100, maxTextureScale: 3,
      animationTextureScale: 1, materialHzCap: 15, animationMaterialHzCap: 5, captureScale: 0.75,
      proxyCapturesPerFrame: 1, cropOverscan: 20, useCanvasFilterBlur: true,
      borderRings: 1, borderDirections: 1, borderDirectionCap: 1
    }),
    performance: Object.freeze({
      key: 'performance', name: '高性能', renderFps: 30, cameraPollMs: 66,
      maintenanceMs: 180, idlePollMs: 160, maxTextureScale: 2,
      animationTextureScale: 1, materialHzCap: 8, animationMaterialHzCap: 3, captureScale: 0.5,
      proxyCapturesPerFrame: 1, cropOverscan: 16, useCanvasFilterBlur: true,
      borderRings: 1, borderDirections: 1, borderDirectionCap: 1
    }),
    battery: Object.freeze({
      key: 'battery', name: '极限省电', renderFps: 20, cameraPollMs: 120,
      maintenanceMs: 350, idlePollMs: 280, maxTextureScale: 1,
      animationTextureScale: 1, materialHzCap: 4, animationMaterialHzCap: 2, captureScale: 0.375,
      proxyCapturesPerFrame: 1, cropOverscan: 12, useCanvasFilterBlur: true,
      borderRings: 1, borderDirections: 1, borderDirectionCap: 1
    })
  });

  function normalizePerformanceMode(value) {
    const raw = Cast.toString(value || '').trim().toLowerCase();
    if (raw === 'quality' || raw === '高画质') return PerformanceMode.QUALITY;
    if (raw === 'balanced' || raw === '均衡') return PerformanceMode.BALANCED;
    if (raw === 'performance' || raw === '高性能') return PerformanceMode.PERFORMANCE;
    if (raw === 'battery' || raw === '极限省电' || raw === '省电') return PerformanceMode.BATTERY;
    return PerformanceMode.AUTO;
  }

  function performanceModeName(mode, autoLevel = 0) {
    const normalized = normalizePerformanceMode(mode);
    if (normalized !== PerformanceMode.AUTO) {
      return PERFORMANCE_CONFIGS[normalized] ? PERFORMANCE_CONFIGS[normalized].name : '均衡';
    }
    const effective = autoLevel >= 3
      ? 'battery'
      : (autoLevel >= 2 ? 'performance' : (autoLevel >= 1 ? 'balanced' : 'quality'));
    return `自动（当前${PERFORMANCE_CONFIGS[effective].name}）`;
  }

  const BoxEffectType = Object.freeze({
    SHAKE: 'shake',
    BREATHE: 'breathe',
    PULSE: 'pulse',
    SWING: 'swing',
    WAVE: 'wave',
    FLOAT: 'float'
  });

  function normalizeBoxEffectType(value) {
    const text = Cast.toString(value || '').trim().toLowerCase();
    if (text === 'shake' || text === '抖动' || text === '震动') return BoxEffectType.SHAKE;
    if (text === 'breathe' || text === '呼吸') return BoxEffectType.BREATHE;
    if (text === 'pulse' || text === '脉冲') return BoxEffectType.PULSE;
    if (text === 'swing' || text === '摆动' || text === '摇摆') return BoxEffectType.SWING;
    if (text === 'wave' || text === '波浪') return BoxEffectType.WAVE;
    if (text === 'float' || text === '漂浮' || text === '浮动') return BoxEffectType.FLOAT;
    return BoxEffectType.SHAKE;
  }

  function normalizeBoxEffectMode(value) {
    const text = Cast.toString(value || '').trim().toLowerCase();
    if (text === 'physics' || text === 'physical' || text === '影响物理' || text === '物理同步') {
      return 'physics';
    }
    return 'visual';
  }

  function boxEffectTypeName(value) {
    const type = normalizeBoxEffectType(value);
    if (type === BoxEffectType.BREATHE) return '呼吸';
    if (type === BoxEffectType.PULSE) return '脉冲';
    if (type === BoxEffectType.SWING) return '摆动';
    if (type === BoxEffectType.WAVE) return '波浪';
    if (type === BoxEffectType.FLOAT) return '漂浮';
    return '抖动';
  }

  function hashBoxEffectSeed(text) {
    const source = Cast.toString(text || 'box-effect');
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < source.length; i++) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash || 1;
  }

  function hashNoise01(seed, index) {
    let value = (seed + Math.imul(index | 0, 0x9e3779b1)) >>> 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d) >>> 0;
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b) >>> 0;
    value ^= value >>> 16;
    return value / 4294967295;
  }

  function smoothBoxNoise(seed, time) {
    const index = Math.floor(time);
    const fraction = time - index;
    const smooth = fraction * fraction * (3 - 2 * fraction);
    const a = hashNoise01(seed, index) * 2 - 1;
    const b = hashNoise01(seed, index + 1) * 2 - 1;
    return a + (b - a) * smooth;
  }

  function identityBoxEffectTransform() {
    return {x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1};
  }

  function combineBoxEffectTransform(target, source) {
    if (!source) return target;
    target.x += finiteNumber(source.x, 0);
    target.y += finiteNumber(source.y, 0);
    target.rotation += finiteNumber(source.rotation, 0);
    target.scaleX *= clamp(finiteNumber(source.scaleX, 1), 0.05, 20);
    target.scaleY *= clamp(finiteNumber(source.scaleY, 1), 0.05, 20);
    return target;
  }

  class BoxEffectSystem {
    constructor(manager, onComplete) {
      this.manager = manager;
      this.onComplete = typeof onComplete === 'function' ? onComplete : null;
      this.localEffects = new Map();
      this.globalEffect = null;
      this.paused = false;
      this.refreshRate = 30;
      this.revision = 0;
      this._refreshAccumulator = 0;
      this._serial = 1;
      this._physicalRestoreCache = new Map();
      this._physicalActiveIds = [];
      this._sampleScratch = identityBoxEffectTransform();
      this._combinedScratch = identityBoxEffectTransform();
      this._visualCache = new Map();
      this._hasPhysicalEffects = false;
    }

    _refreshPhysicalFlag() {
      let active = Boolean(this.globalEffect && this.globalEffect.mode === 'physics');
      if (!active) {
        for (const effect of this.localEffects.values()) {
          if (effect && effect.mode === 'physics') { active = true; break; }
        }
      }
      this._hasPhysicalEffects = active;
      return active;
    }

    clear() {
      this.restorePhysicalEffects();
      this.localEffects.clear();
      this.globalEffect = null;
      this._visualCache.clear();
      this._hasPhysicalEffects = false;
      this.paused = false;
      this._refreshAccumulator = 0;
      this.revision++;
    }

    setRefreshRate(value) {
      this.refreshRate = clamp(Math.round(finiteNumber(value, 30)), 5, 60);
      this._refreshAccumulator = 0;
      this.revision++;
    }

    _makeEffect(typeValue, strengthValue, speedValue, durationValue, modeValue, scopeKey) {
      const type = normalizeBoxEffectType(typeValue);
      const strength = clamp(Math.abs(finiteNumber(strengthValue, 6)), 0, 500);
      const speed = clamp(Math.abs(finiteNumber(speedValue, 4)), 0.01, 60);
      const duration = Math.max(0, finiteNumber(durationValue, 0));
      const mode = normalizeBoxEffectMode(modeValue);
      const serial = this._serial++;
      return {
        type,
        strength,
        speed,
        duration,
        mode,
        elapsed: 0,
        seed: hashBoxEffectSeed(`${scopeKey}|${type}|${serial}`)
      };
    }

    setForBox(idValue, type, strength, speed, duration, mode) {
      const id = safeId(idValue);
      if (!this.manager || !this.manager.areaRecords || !this.manager.areaRecords.has(id)) return false;
      this.localEffects.set(id, this._makeEffect(type, strength, speed, duration, mode, id));
      this._refreshPhysicalFlag();
      this.revision++;
      return true;
    }

    setForAll(type, strength, speed, duration, mode) {
      this.globalEffect = this._makeEffect(type, strength, speed, duration, mode, '*');
      this._refreshPhysicalFlag();
      this.revision++;
      return true;
    }

    stopForBox(idValue) {
      const stopped = this.localEffects.delete(safeId(idValue));
      if (stopped) { this._refreshPhysicalFlag(); this.revision++; }
      return stopped;
    }

    stopForAll() {
      if (!this.globalEffect) return false;
      this.globalEffect = null;
      this._refreshPhysicalFlag();
      this.revision++;
      return true;
    }

    clearAllEffects() {
      const changed = this.localEffects.size > 0 || Boolean(this.globalEffect);
      this.restorePhysicalEffects();
      this.localEffects.clear();
      this.globalEffect = null;
      this._visualCache.clear();
      this._hasPhysicalEffects = false;
      if (changed) this.revision++;
      return changed;
    }

    hasActiveEffects() {
      return Boolean(this.globalEffect || this.localEffects.size > 0);
    }

    isActiveForBox(idValue) {
      return Boolean(this.globalEffect || this.localEffects.has(safeId(idValue)));
    }

    getRevision() {
      return this.revision;
    }

    _sampleInto(effect, result) {
      result.x = 0; result.y = 0; result.rotation = 0; result.scaleX = 1; result.scaleY = 1;
      if (!effect) return result;
      const t = Math.max(0, effect.elapsed) * effect.speed;
      const strength = effect.strength;
      const phase = t * Math.PI * 2;
      switch (effect.type) {
        case BoxEffectType.BREATHE: {
          const scale = 1 + Math.sin(phase) * strength * 0.01;
          result.scaleX = scale; result.scaleY = scale;
          break;
        }
        case BoxEffectType.PULSE: {
          const wave = Math.pow(Math.max(0, Math.sin(phase)), 2);
          const scale = 1 + wave * strength * 0.01;
          result.scaleX = scale; result.scaleY = scale;
          break;
        }
        case BoxEffectType.SWING:
          result.rotation = Math.sin(phase) * strength;
          break;
        case BoxEffectType.WAVE:
          result.y = Math.sin(phase) * strength;
          result.x = Math.cos(phase * 0.5) * strength * 0.18;
          break;
        case BoxEffectType.FLOAT:
          result.y = Math.sin(phase) * strength;
          result.rotation = Math.sin(phase * 0.5) * Math.min(8, strength * 0.18);
          break;
        case BoxEffectType.SHAKE:
        default: {
          const noiseTime = t * 3.2;
          result.x = smoothBoxNoise(effect.seed, noiseTime) * strength;
          result.y = smoothBoxNoise(effect.seed ^ 0xa53a9e37, noiseTime * 1.17 + 19.31) * strength;
          result.rotation = smoothBoxNoise(effect.seed ^ 0x71c8e4d5, noiseTime * 0.83 + 7.7) * Math.min(8, strength * 0.35);
          break;
        }
      }
      result.scaleX = clamp(result.scaleX, 0.05, 20);
      result.scaleY = clamp(result.scaleY, 0.05, 20);
      return result;
    }

    _combinedForBoxInto(idValue, physicsOnly, result) {
      const id = safeId(idValue);
      result.x = 0; result.y = 0; result.rotation = 0; result.scaleX = 1; result.scaleY = 1;
      const sample = this._sampleScratch;
      if (this.globalEffect && (!physicsOnly || this.globalEffect.mode === 'physics')) {
        combineBoxEffectTransform(result, this._sampleInto(this.globalEffect, sample));
      }
      const local = this.localEffects.get(id);
      if (local && (!physicsOnly || local.mode === 'physics')) {
        combineBoxEffectTransform(result, this._sampleInto(local, sample));
      }
      return result;
    }

    getVisualTransform(idValue, out = this._combinedScratch) {
      const id = safeId(idValue);
      let entry = this._visualCache.get(id);
      if (!entry) {
        entry = {revision: -1, value: identityBoxEffectTransform()};
        this._visualCache.set(id, entry);
      }
      if (entry.revision !== this.revision) {
        this._combinedForBoxInto(id, false, entry.value);
        entry.revision = this.revision;
      }
      if (out === entry.value) return out;
      out.x = entry.value.x;
      out.y = entry.value.y;
      out.rotation = entry.value.rotation;
      out.scaleX = entry.value.scaleX;
      out.scaleY = entry.value.scaleY;
      return out;
    }

    update(deltaSeconds) {
      if (this.paused || !this.hasActiveEffects()) {
        this._refreshAccumulator = 0;
        return false;
      }
      const dt = Math.max(0, Math.min(0.25, finiteNumber(deltaSeconds, 0)));
      if (!(dt > 0)) return false;
      let completedAny = false;
      let removedAny = false;

      if (this.globalEffect) {
        this.globalEffect.elapsed += dt;
        if (this.globalEffect.duration > 0 && this.globalEffect.elapsed >= this.globalEffect.duration) {
          this.globalEffect = null;
          completedAny = true;
          if (this.onComplete) this.onComplete('全部框');
        }
      }

      for (const [id, effect] of this.localEffects) {
        if (!this.manager.areaRecords.has(id)) {
          this.localEffects.delete(id);
          removedAny = true;
          continue;
        }
        effect.elapsed += dt;
        if (effect.duration > 0 && effect.elapsed >= effect.duration) {
          this.localEffects.delete(id);
          completedAny = true;
          if (this.onComplete) this.onComplete(id);
        }
      }
      if (completedAny || removedAny) this._refreshPhysicalFlag();

      this._refreshAccumulator += dt;
      const interval = 1 / Math.max(5, this.refreshRate);
      let changed = completedAny || removedAny;
      if (this.hasActiveEffects() && this._refreshAccumulator >= interval) {
        this._refreshAccumulator %= interval;
        changed = true;
      }
      if (changed) this.revision++;
      return changed;
    }

    applyPhysicalEffects() {
      this.restorePhysicalEffects();
      if (this.paused || !this._hasPhysicalEffects || !this.manager || !this.manager.areaRecords) return false;
      let changed = false;
      const effect = this._combinedScratch;
      for (const record of this.manager.areaRecords.values()) {
        if (!record || !record.enabled || !record.transform || !record.transform.valid) continue;
        this._combinedForBoxInto(record.id, true, effect);
        const isIdentity = Math.abs(effect.x) < 1e-10 && Math.abs(effect.y) < 1e-10 &&
          Math.abs(effect.rotation) < 1e-10 && Math.abs(effect.scaleX - 1) < 1e-10 &&
          Math.abs(effect.scaleY - 1) < 1e-10;
        if (isIdentity) continue;
        const transform = record.transform;
        let saved = this._physicalRestoreCache.get(record.id);
        if (!saved) {
          saved = {transform: null, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1};
          this._physicalRestoreCache.set(record.id, saved);
        }
        saved.transform = transform;
        saved.x = transform.pos.x;
        saved.y = transform.pos.y;
        saved.rotation = transform.rotation;
        saved.scaleX = transform.scaleX;
        saved.scaleY = transform.scaleY;
        this._physicalActiveIds.push(record.id);
        transform.setPosition(transform.pos.x + effect.x, transform.pos.y + effect.y);
        transform.setRotation(transform.rotation + degreesToRadians(effect.rotation));
        transform.setScale(
          safeScale(transform.scaleX * effect.scaleX),
          safeScale(transform.scaleY * effect.scaleY)
        );
        changed = true;
      }
      return changed;
    }

    restorePhysicalEffects() {
      if (this._physicalActiveIds.length === 0) return false;
      for (let i = 0; i < this._physicalActiveIds.length; i++) {
        const saved = this._physicalRestoreCache.get(this._physicalActiveIds[i]);
        if (!saved || !saved.transform) continue;
        saved.transform.setPosition(saved.x, saved.y);
        saved.transform.setRotation(saved.rotation);
        saved.transform.setScale(saved.scaleX, saved.scaleY);
      }
      this._physicalActiveIds.length = 0;
      return true;
    }

    getEffectNameForBox(idValue) {
      const id = safeId(idValue);
      const names = [];
      if (this.globalEffect) names.push(`全部框 ${boxEffectTypeName(this.globalEffect.type)}`);
      const local = this.localEffects.get(id);
      if (local) names.push(`单框 ${boxEffectTypeName(local.type)}`);
      return names.join(' + ');
    }

    getGlobalEffectName() {
      return this.globalEffect ? boxEffectTypeName(this.globalEffect.type) : '';
    }
  }


  // ==================== Phase 4C.0 统一圆角框、Tween 与 Stencil 裁剪 ====================
  // 正式战斗框不再使用覆盖舞台的 DOM Canvas，而是上传为 Scratch Renderer
  // 的 BitmapSkin/Drawable。默认加入 background 层组并置于背景之后，所有
  // 普通精灵与克隆会由同一 WebGL 提交自然绘制在战斗框之上，因此无需逐精灵
  // 裁剪，也不会产生遮罩延迟、透明洞拖尾或快速移动残影。
  // DOM Canvas 仅在“碰撞体调试渲染”开启时使用。
  class BattleBoxRenderer {
    constructor(manager, effectSystem = null) {
      this.manager = manager;
      this.effectSystem = effectSystem;
      this.enabled = true;
      this.debugHitboxes = false;
      this.debugSoulCollider = false;
      this.layerMode = 'behind';

      this.borderColor = '#ffffff';
      this.fillColor = '#000000';
      this.borderWidth = 4;
      this.fillOpacity = 0.28;

      // 背景材质系统：solid = 纯色，gaussian = 后景高斯模糊，glass = 毛玻璃。
      // 动态材质通过 Renderer 私有绘制管线把当前 Drawable 下方的场景渲染到
      // 独立 FBO，再在 Canvas2D 中执行模糊、染色和颗粒合成。不会读取 DOM
      // 屏幕截图，因此全屏与浏览器缩放不会改变 Scratch 逻辑坐标。
      this.backgroundMaterial = 'solid';
      this.blurRadius = 10;
      this.materialRefreshHz = 12;
      this.glassTintColor = '#dcecff';
      this.glassTintOpacity = 0.22;
      this.glassSaturation = 1.25;
      this.glassNoiseOpacity = 0.035;
      // 动态材质的暗色遮罩与纯色填充彻底分离。旧版复用 fillOpacity，
      // 当用户沿用 100% 黑底时会把已经生成的模糊画面完全盖住，看起来像
      // “只能渲染纯色”。动态材质默认只叠加 18% 暗色。
      this.materialShadeOpacity = 0.18;

      // Phase 4B.8：位图战斗框必须强制使用线性纹理采样。Scratch 的
      // BitmapSkin 默认 useNearest() 为 true；舞台窗口放大时会把每个逻辑
      // 像素直接放大成方块，造成看似“低清模糊”的阶梯边缘。
      this.forceLinearTextureSampling = true;

      // Phase 4C.4/4C.5：摄像机放大后使用超采样位图；
      // Phase 4C.5 同时保证 BitmapSkin 旋转中心保持逻辑坐标，避免缩放漂移。
      // 使用 BitmapSkin costumeResolution 做自适应超采样，保持逻辑尺寸不变。
      // auto 根据 Camera V2 缩放与显示像素密度选择 1～4 倍；手动档位可在
      // 老设备上强制 1 倍，或固定 2/4 倍画质。
      this.antiAliasQuality = 'auto';
      this._textureScale = 1;
      this._detectedCameraZoom = 1;
      this._detectedDisplayScale = 1;
      this._cameraCompatibilityStatus = '等待检测摄像机';

      // Phase 4C.6：Camera V2 缩小时会显示原舞台之外的世界。旧版 BitmapSkin
      // 只覆盖固定 480×360 逻辑范围，舞台外没有纹理。本模式按摄像机可见范围
      // 动态维护一个带预留边缘的世界纹理区域，并在相机移动到安全边缘之外时
      // 才重新分配，避免每移动 1 像素都重建大 Canvas。
      this.adaptiveViewportRendering = true;
      this.adaptiveViewportMarginPixels = 96;
      this.adaptiveViewportMaxScale = 4;
      this._adaptiveRegion = null;
      this._adaptiveViewportStatus = '等待检测 Camera V2';
      this._lastCameraViewState = null;

      // Phase 4C.10：连续拖动 Camera V2 缩放时，旧版本会在每一个倍率变化
      // 上重新分配多张大 Canvas 并重新上传 BitmapSkin。Chromium/旧显卡通常不会
      // 立即回收上一张 GPU 纹理，短时间内会形成显存峰值，严重时导致 GPU 进程
      // crashed (34)。显存保护默认开启：缩放拖动期间冻结世界纹理尺寸，停止
      // 动态后景采样，等待倍率稳定后只重建一次，并对单张纹理设置像素预算。
      this.gpuZoomMemoryGuard = true;
      this.gpuZoomSettleMs = 220;
      this.gpuTextureBudgetMP = 3.0;
      this.gpuMaxTextureDimension = 2048;
      this._lastObservedCameraZoom = NaN;
      this._lastCameraZoomChangeMs = -Infinity;
      this._cameraZoomActive = false;
      this._cameraZoomJustSettled = false;
      this._committedEffectRevision = 0;
      this._lastGpuTexturePixels = 0;
      this._lastGpuTextureBytes = 0;
      this._gpuMemoryGuardStatus = '显存保护等待 Camera V2';
      this._contextLossCanvas = null;
      this._contextLostHandler = null;
      this._contextRestoredHandler = null;

      // 全分辨率高斯工作区。常用半径使用真正的可分离高斯卷积；超大半径
      // 使用全分辨率四次 box blur 近似，绝不再通过缩小纹理制造模糊。
      this._gaussianTemp = null;
      this._gaussianOutput = null;
      this._gaussianImageData = null;
      this._gaussianKernel = null;
      this._gaussianKernelKey = '';
      this._boxBlurTemp = null;
      this._boxBlurOutput = null;
      this._blurAlgorithmName = '等待生成';

      this._materialLastCaptureMs = -Infinity;
      this._materialFallbackReason = '';
      this._materialCaptureActive = false;
      this._materialBackendName = '未检测';
      this._materialCaptureFailures = 0;

      this.maskCanvas = null;
      this.maskContext = null;
      this.tintCanvas = null;
      this.tintContext = null;
      this.borderCanvas = null;
      this.borderContext = null;
      this.cacheCanvas = null;
      this.cacheContext = null;
      this.captureCanvas = null;
      this.captureContext = null;
      this.blurCanvas = null;
      this.blurContext = null;
      this.blurWorkCanvas = null;
      this.blurWorkContext = null;
      this.noiseCanvas = null;
      this.noiseContext = null;

      // 单个后景采样 FBO 在全局框和各角色代理之间复用；最终材质纹理按
      // Drawable 图层分别生成，从而保证“用框替换当前角色”时只模糊其下方内容。
      this._captureFramebuffer = null;
      this._captureTexture = null;
      this._captureWidth = 0;
      this._captureHeight = 0;
      this._capturePixels = null;
      this._captureImageData = null;
      this._captureCandidateIds = [];
      this._proxyMaterialRecords = [];

      this.debugCanvas = null;
      this.debugContext = null;
      this._debugBaseCanvas = null;
      this._debugParent = null;
      this._debugParentOldPosition = '';

      this._renderer = null;
      this._skinId = null;
      this._drawableId = null;
      this._drawableGroup = null;
      this._nativeWidth = 0;
      this._nativeHeight = 0;
      this._nativeReady = false;
      this._nativeError = '';
      this._nativeMetricsKey = '';

      // 当前角色图层代理。每个 Target（包括克隆）拥有独立代理 Drawable，
      // 但共享同一个战斗框 BitmapSkin。原角色只在 Renderer 层被隐藏，
      // target.visible 等 Scratch 逻辑状态不会被篡改。
      this._replacementRecords = new Map();

      // Phase 4B.9：按具体 Target（包含克隆）记录框内裁剪。裁剪不复制
      // 精灵纹理，也不修改 target.visible，而是在 Scratch Renderer 的主画面
      // _drawThese 调用中用 WebGL stencil 限制指定 Drawable 的颜色输出。
      this._interiorClipRecords = new Map();
      this._clipDrawableIds = new Set();
      this._clipMaskSkinId = null;
      this._clipMaskDrawableId = null;
      this._clipMaskGroup = null;
      this._clipMaskMetricsKey = '';
      this._clipMaskDirty = true;
      this._clipHookRenderer = null;
      this._clipOriginalDrawThese = null;
      this._clipWrappedDrawThese = null;
      this._clipBypassDepth = 0;
      this._clipBackendName = '等待初始化 WebGL Stencil';
      this._clipLastError = '';

      // 逻辑舞台尺寸必须与 CSS/全屏像素尺寸彻底解耦。
      // renderer 的舞台边界是第一信源；仅在宿主未暴露边界时锁定首个 runtime 尺寸。
      this._fallbackStageWidth = 0;
      this._fallbackStageHeight = 0;

      this._dirty = true;
      this._lastBuildKey = '';

      // Phase 4C.13：按需渲染与动态性能调度。以前只要启用摄像机自适应、
      // Stencil 或代理，扩展就会每 20ms 完整执行一次 metrics、图层同步和
      // BitmapSkin 检查，即使画面完全静止。现在将相机检测、代理维护、材质
      // 刷新和静态纹理重建拆成独立频率，并缓存没有变化的结果。
      this.performanceMode = PerformanceMode.AUTO;
      this.autoPerformanceLevel = 0;
      this._cachedMetrics = null;
      this._lastMetricsPollMs = -Infinity;
      this._lastMaintenanceMs = -Infinity;
      this._cachedReplacementCount = 0;
      this._cachedInteriorClipCount = 0;
      this._lastNativeTransformKey = '';
      this._lastDebugRenderMs = -Infinity;
      this._renderCalls = 0;
      this._renderSkips = 0;
      this._staticBuildCount = 0;
      this._materialUpdateCount = 0;
      this._maintenanceCount = 0;
      this._borderDrawCallsLast = 0;
      this._borderDrawCallsTotal = 0;
      this._effectScratch = identityBoxEffectTransform();
      this._contentRegion = null;
      this._contentCropStatus = '等待计算内容范围';
      this._contentCropRatio = 1;
      this._contentVisible = true;
      this._lastMetricsCollisionVersion = -1;
      this._lastMetricsEffectRevision = -1;
      this._animationActive = false;
      this._proxyCaptureCursor = 0;
      this._deferredMaterialCapture = false;
      this._hasCapturedBackdrop = false;
      this._captureCount = 0;
      this._composeOnlyCount = 0;
      this._lastBuildPixels = 0;
    }

    markDirty(invalidateBackdrop = false, forceMaintenance = false) {
      // Raster/geometry dirtiness is much more frequent than target/layer-structure
      // changes. In Phase 4C.14 every effect revision reset _lastMaintenanceMs, so a
      // 60 FPS shake also scanned every replacement target, clip target and Drawable
      // 60 times per second. Keep those invalidation domains separate.
      this._dirty = true;
      this._clipMaskDirty = true;
      if (invalidateBackdrop) {
        this._materialLastCaptureMs = -Infinity;
        this._hasCapturedBackdrop = false;
        this._deferredMaterialCapture = false;
      }
      if (forceMaintenance) this._lastMaintenanceMs = -Infinity;
      this._lastMetricsPollMs = -Infinity;
    }

    setAnimationActivity(tweenActive, effectActive) {
      const next = Boolean(tweenActive || effectActive);
      if (next === this._animationActive) return false;
      this._animationActive = next;
      this._cachedMetrics = null;
      this._lastMetricsPollMs = -Infinity;
      this._dirty = true;
      return true;
    }

    setPerformanceMode(mode, autoLevel = this.autoPerformanceLevel) {
      this.performanceMode = normalizePerformanceMode(mode);
      this.autoPerformanceLevel = clamp(Math.round(finiteNumber(autoLevel, 0)), 0, 3);
      this.markDirty();
      this._requestRedraw();
    }

    setAutoPerformanceLevel(level) {
      const next = clamp(Math.round(finiteNumber(level, 0)), 0, 3);
      if (this.autoPerformanceLevel === next) return false;
      this.autoPerformanceLevel = next;
      if (this.performanceMode === PerformanceMode.AUTO) this.markDirty();
      return true;
    }

    _getPerformanceConfig() {
      let key = this.performanceMode;
      if (key === PerformanceMode.AUTO) {
        key = this.autoPerformanceLevel >= 3
          ? PerformanceMode.BATTERY
          : (this.autoPerformanceLevel >= 2
            ? PerformanceMode.PERFORMANCE
            : (this.autoPerformanceLevel >= 1 ? PerformanceMode.BALANCED : PerformanceMode.QUALITY));
      }
      return PERFORMANCE_CONFIGS[key] || PERFORMANCE_CONFIGS.balanced;
    }

    resetPerformanceStats() {
      this._renderCalls = 0;
      this._renderSkips = 0;
      this._staticBuildCount = 0;
      this._materialUpdateCount = 0;
      this._maintenanceCount = 0;
      this._borderDrawCallsLast = 0;
      this._borderDrawCallsTotal = 0;
      this._captureCount = 0;
      this._composeOnlyCount = 0;
    }

    getPerformanceStatus() {
      const config = this._getPerformanceConfig();
      const effectiveMaterialHz = Math.min(this.materialRefreshHz, config.materialHzCap);
      return `${performanceModeName(this.performanceMode, this.autoPerformanceLevel)}；` +
        `渲染上限 ${config.renderFps} FPS，材质 ${effectiveMaterialHz} FPS；` +
        `绘制 ${this._renderCalls}，跳过 ${this._renderSkips}，静态重建 ${this._staticBuildCount}，` +
        `材质更新 ${this._materialUpdateCount}（采样 ${this._captureCount} / 复用 ${this._composeOnlyCount}），图层维护 ${this._maintenanceCount}；` +
        `边框路径 ${this._borderDrawCallsLast}，内容裁剪 ${(this._contentCropRatio * 100).toFixed(1)}%，最近重建 ${(this._lastBuildPixels / 1000).toFixed(0)}K 像素`;
    }

    _isMaterialUpdateDue(now, force, staticChanged) {
      if (force) return true;
      if (this.backgroundMaterial === 'solid') return Boolean(staticChanged || this._materialLastCaptureMs < 0);
      if (staticChanged || this._deferredMaterialCapture || this._materialLastCaptureMs < 0) return true;
      if (this._isGpuZoomFreezeActive()) return false;
      for (const record of this._replacementRecords.values()) {
        if (Number.isFinite(record.proxyDrawableId) && record.materialSkinId === null) return true;
      }
      const config = this._getPerformanceConfig();
      const materialCap = this._animationActive
        ? Math.min(config.materialHzCap, config.animationMaterialHzCap || config.materialHzCap)
        : config.materialHzCap;
      const effectiveHz = Math.max(1, Math.min(this.materialRefreshHz, materialCap));
      return now - this._materialLastCaptureMs >= 1000 / effectiveHz;
    }

    hasImmediateWork(nowMs = getNowMs()) {
      const now = Number.isFinite(nowMs) ? nowMs : getNowMs();
      if (this._dirty || !this._nativeReady || this._cameraZoomJustSettled) return true;
      const currentEffectRevision = this.effectSystem ? this.effectSystem.getRevision() : 0;
      if (currentEffectRevision !== this._committedEffectRevision && !this._isGpuZoomFreezeActive()) return true;
      if (this._isMaterialUpdateDue(now, false, false)) return true;
      const config = this._getPerformanceConfig();
      if ((this._replacementRecords.size > 0 || this._interiorClipRecords.size > 0) &&
          now - this._lastMaintenanceMs >= config.maintenanceMs) return true;
      return false;
    }

    setEnabled(value) {
      this.enabled = Boolean(value);
      this._setNativeVisible(this.enabled && this._replacementRecords.size === 0);
      if (!this.enabled) this._hideDebugOverlay();
      this.markDirty();
      this._requestRedraw();
    }

    setLayerMode(value) {
      const next = value === 'front' ? 'front' : 'behind';
      if (this.layerMode === next) return;
      this.layerMode = next;
      this._disposeDrawableOnly();
      this.markDirty();
    }

    setTargetReplacement(target, enabled) {
      if (!target || target.isStage) return false;
      const nextEnabled = Boolean(enabled);
      const existing = this._replacementRecords.get(target);

      if (!nextEnabled) {
        if (!existing) return true;
        this._destroyReplacementRecord(existing, true);
        this._replacementRecords.delete(target);
        this.markDirty(false, true);
        this._requestRedraw();
        return true;
      }

      // 同一 Target 不能同时被框替换和被框内裁剪。开启替换时，
      // 先关闭该 Target 的裁剪，但不影响其他角色或克隆。
      if (this._interiorClipRecords.has(target)) {
        this.setTargetInteriorClip(target, false);
      }

      if (!existing) {
        this._replacementRecords.set(target, {
          target,
          originalDrawableId: null,
          proxyDrawableId: null,
          proxyGroup: null,
          materialCanvas: null,
          materialContext: null,
          materialSkinId: null,
          materialWidth: 0,
          materialHeight: 0
        });
      }
      this.markDirty(false, true);
      this._requestRedraw();
      return true;
    }

    isTargetReplaced(target) {
      return Boolean(target && this._replacementRecords.has(target));
    }

    getReplacementCount() {
      return this._replacementRecords.size;
    }

    restoreAllTargetReplacements() {
      const records = Array.from(this._replacementRecords.values());
      for (let i = 0; i < records.length; i++) {
        this._destroyReplacementRecord(records[i], true);
      }
      this._replacementRecords.clear();
      this.markDirty(false, true);
      this._requestRedraw();
    }

    setTargetInteriorClip(target, enabled) {
      if (!target || target.isStage) return false;
      const nextEnabled = Boolean(enabled);
      const existing = this._interiorClipRecords.get(target);

      if (!nextEnabled) {
        if (existing) {
          this._interiorClipRecords.delete(target);
          if (Number.isFinite(existing.drawableId)) {
            this._clipDrawableIds.delete(existing.drawableId);
          }
        }
        this.markDirty(false, true);
        this._requestRedraw();
        return true;
      }

      // 裁剪与“用框替换当前角色”互斥。裁剪保留原 Drawable，因此先恢复
      // 可能存在的代理替换，避免目标仍然处于 Renderer 隐藏状态。
      if (this._replacementRecords.has(target)) {
        this.setTargetReplacement(target, false);
      }

      if (!existing) {
        this._interiorClipRecords.set(target, {
          target,
          drawableId: null
        });
      }
      this._clipLastError = '';
      this.markDirty(false, true);
      this._requestRedraw();
      return true;
    }

    isTargetInteriorClipped(target) {
      return Boolean(target && this._interiorClipRecords.has(target));
    }

    getInteriorClipCount() {
      return this._interiorClipRecords.size;
    }

    restoreAllTargetInteriorClips() {
      this._interiorClipRecords.clear();
      this._clipDrawableIds.clear();
      this.markDirty(false, true);
      this._requestRedraw();
    }

    getInteriorClipBackendName() {
      if (this._clipLastError) return `不可用：${this._clipLastError}`;
      return this._clipBackendName || '等待初始化 WebGL Stencil';
    }

    getLayerModeName() {
      if (this._replacementRecords.size > 0) return '替换当前角色图层';
      return this.layerMode === 'front' ? '全局精灵前方' : '全局精灵后方';
    }

    setStyle(borderColor, borderWidth, fillOpacity) {
      const color = Cast.toString(borderColor || '').trim();
      if (color) this.borderColor = color;
      this.borderWidth = clamp(Math.round(finiteNumber(borderWidth, 4)), 1, 24);
      this.fillOpacity = clamp(finiteNumber(fillOpacity, 0.28), 0, 1);
      this.markDirty();
    }

    setAntiAliasQuality(value) {
      const raw = Cast.toString(value || '').trim().toLowerCase();
      let next = 'auto';
      if (raw === 'performance' || raw === '性能' || raw === '1x') next = 'performance';
      else if (raw === 'high' || raw === '高清' || raw === '2x') next = 'high';
      else if (raw === 'ultra' || raw === '超清' || raw === '4x') next = 'ultra';
      if (this.antiAliasQuality === next) return;
      this.antiAliasQuality = next;
      this._textureScale = 0;
      this.markDirty();
      this._requestRedraw();
    }

    getAntiAliasQualityName() {
      if (this.antiAliasQuality === 'performance') return '性能（1×）';
      if (this.antiAliasQuality === 'high') return '高清（2×）';
      if (this.antiAliasQuality === 'ultra') return '超清（4×）';
      return '自动';
    }

    getTextureScale() {
      return Number.isFinite(this._textureScale) && this._textureScale > 0
        ? this._textureScale
        : 1;
    }

    getCameraCompatibilityStatus() {
      return this._cameraCompatibilityStatus || '未检测';
    }

    setAdaptiveViewportRendering(value, marginPixels, maxScale) {
      this.adaptiveViewportRendering = Boolean(value);
      this.adaptiveViewportMarginPixels = clamp(finiteNumber(marginPixels, 96), 0, 480);
      this.adaptiveViewportMaxScale = clamp(finiteNumber(maxScale, 4), 1, 8);
      this._adaptiveRegion = null;
      this.markDirty();
      this._requestRedraw();
    }

    getAdaptiveViewportStatus() {
      return this._adaptiveViewportStatus || '未初始化';
    }

    setGpuZoomMemoryGuard(value, settleMs, budgetMP) {
      this.gpuZoomMemoryGuard = Boolean(value);
      this.gpuZoomSettleMs = clamp(Math.round(finiteNumber(settleMs, 220)), 80, 1000);
      this.gpuTextureBudgetMP = clamp(finiteNumber(budgetMP, 3.0), 1.0, 16.0);
      this._lastObservedCameraZoom = NaN;
      this._lastCameraZoomChangeMs = -Infinity;
      this._cameraZoomActive = false;
      this._cameraZoomJustSettled = false;
      this._adaptiveRegion = null;
      this._textureScale = 0;
      this.markDirty();
      this._requestRedraw();
    }

    getGpuMemoryGuardStatus() {
      return this._gpuMemoryGuardStatus || (this.gpuZoomMemoryGuard ? '显存保护已开启' : '显存保护已关闭');
    }

    _observeCameraZoom(zoom) {
      const safeZoom = Math.max(0.01, Math.abs(finiteNumber(zoom, 1)));
      const now = getNowMs();
      this._cameraZoomJustSettled = false;
      if (!Number.isFinite(this._lastObservedCameraZoom)) {
        this._lastObservedCameraZoom = safeZoom;
        this._lastCameraZoomChangeMs = now;
        this._cameraZoomActive = false;
        return;
      }
      const relativeChange = Math.abs(safeZoom - this._lastObservedCameraZoom) /
        Math.max(0.01, this._lastObservedCameraZoom);
      if (relativeChange > 0.0015) {
        this._lastObservedCameraZoom = safeZoom;
        this._lastCameraZoomChangeMs = now;
        this._cameraZoomActive = Boolean(this.gpuZoomMemoryGuard);
        if (this._cameraZoomActive) {
          this._gpuMemoryGuardStatus = `摄像机缩放中：冻结纹理与动态采样，等待 ${this.gpuZoomSettleMs} ms`;
        }
        return;
      }
      if (
        this._cameraZoomActive &&
        now - this._lastCameraZoomChangeMs >= this.gpuZoomSettleMs
      ) {
        this._cameraZoomActive = false;
        this._cameraZoomJustSettled = true;
        this._adaptiveRegion = null;
        this._textureScale = 0;
        this._dirty = true;
        this._clipMaskDirty = true;
        this._materialLastCaptureMs = -Infinity;
      }
    }

    _isGpuZoomFreezeActive() {
      return Boolean(this.gpuZoomMemoryGuard && this._cameraZoomActive);
    }

    _installContextLossHandlers(renderer) {
      const canvas = renderer && renderer.canvas;
      if (!canvas || typeof canvas.addEventListener !== 'function') return false;
      if (this._contextLossCanvas === canvas) return true;
      if (this._contextLossCanvas && typeof this._contextLossCanvas.removeEventListener === 'function') {
        try {
          if (this._contextLostHandler) this._contextLossCanvas.removeEventListener('webglcontextlost', this._contextLostHandler);
          if (this._contextRestoredHandler) this._contextLossCanvas.removeEventListener('webglcontextrestored', this._contextRestoredHandler);
        } catch (error) { /* ignored */ }
      }
      this._contextLossCanvas = canvas;
      this._contextLostHandler = event => {
        try { if (event && typeof event.preventDefault === 'function') event.preventDefault(); } catch (error) { /* ignored */ }
        this._nativeReady = false;
        this._materialCaptureActive = false;
        this._captureFramebuffer = null;
        this._captureTexture = null;
        this._capturePixels = null;
        this._captureImageData = null;
        this._gpuMemoryGuardStatus = 'WebGL 上下文丢失：已停止纹理上传，等待宿主恢复';
      };
      this._contextRestoredHandler = () => {
        this._skinId = null;
        this._drawableId = null;
        this._drawableGroup = null;
        this._clipMaskSkinId = null;
        this._clipMaskDrawableId = null;
        for (const record of this._replacementRecords.values()) {
          record.proxyDrawableId = null;
          record.materialSkinId = null;
        }
        this._nativeReady = false;
        this._adaptiveRegion = null;
        this._textureScale = 0;
        this.markDirty(false, true);
        this._gpuMemoryGuardStatus = 'WebGL 已恢复：正在安全重建战斗框资源';
        this._requestRedraw();
      };
      canvas.addEventListener('webglcontextlost', this._contextLostHandler, false);
      canvas.addEventListener('webglcontextrestored', this._contextRestoredHandler, false);
      return true;
    }

    _getCameraV2ViewState(renderer) {
      const resultFromDrawable = drawable => {
        const state = findCameraV2State(drawable);
        if (!state) return null;
        const signedZoom = Number.isFinite(state.ogSZ) && Math.abs(state.ogSZ) > 1e-9
          ? state.ogSZ
          : 1;
        const result = {
          detected: true,
          name: state.name || 'default',
          offsetX: Number.isFinite(state.ogXY[0]) ? state.ogXY[0] : 0,
          offsetY: Number.isFinite(state.ogXY[1]) ? state.ogXY[1] : 0,
          centerX: -(Number.isFinite(state.ogXY[0]) ? state.ogXY[0] : 0),
          centerY: -(Number.isFinite(state.ogXY[1]) ? state.ogXY[1] : 0),
          zoom: Math.max(0.01, Math.abs(signedZoom)),
          signedZoom,
          direction: Number.isFinite(state.ogDir) ? state.ogDir : 0
        };
        this._observeCameraZoom(result.zoom);
        return result;
      };

      if (renderer && renderer._allDrawables) {
        const candidateIds = [];
        if (Number.isFinite(this._drawableId)) candidateIds.push(this._drawableId);
        if (Number.isFinite(this._clipMaskDrawableId)) candidateIds.push(this._clipMaskDrawableId);
        for (const record of this._replacementRecords.values()) {
          if (Number.isFinite(record.proxyDrawableId)) candidateIds.push(record.proxyDrawableId);
        }
        for (let i = 0; i < candidateIds.length; i++) {
          const found = resultFromDrawable(renderer._allDrawables[candidateIds[i]]);
          if (found) {
            this._cameraCompatibilityStatus = `Camera V2 已检测，缩放 ${found.zoom.toFixed(3)}×；超采样锚点锁定，自适应视口已启用`;
            this._lastCameraViewState = found;
            return found;
          }
        }

        // 第一次创建战斗框 Drawable 之前，从现有对象中优先寻找 default 摄像机。
        // Camera V2 会把同一摄像机状态写入所有绑定 Drawable 的私有 Symbol。
        let first = null;
        for (let i = 0; i < renderer._allDrawables.length; i++) {
          const found = resultFromDrawable(renderer._allDrawables[i]);
          if (!found) continue;
          if (!first) first = found;
          if (found.name === 'default') {
            this._cameraCompatibilityStatus = `Camera V2 已检测，缩放 ${found.zoom.toFixed(3)}×；超采样锚点锁定，自适应视口已启用`;
            this._lastCameraViewState = found;
            return found;
          }
        }
        if (first) {
          this._cameraCompatibilityStatus = `Camera V2 已检测，缩放 ${first.zoom.toFixed(3)}×；超采样锚点锁定，自适应视口已启用`;
          this._lastCameraViewState = first;
          return first;
        }
      }

      const fallback = {
        detected: false,
        name: 'default',
        offsetX: 0,
        offsetY: 0,
        centerX: 0,
        centerY: 0,
        zoom: 1,
        signedZoom: 1,
        direction: 0
      };
      this._lastCameraViewState = fallback;
      return fallback;
    }

    _computeAdaptiveWorldRegion(baseMetrics, cameraView) {
      if (!this.adaptiveViewportRendering || !cameraView || !cameraView.detected) {
        this._adaptiveRegion = null;
        this._adaptiveViewportStatus = this.adaptiveViewportRendering
          ? '未检测到 Camera V2，使用原舞台 480×360 逻辑范围'
          : '摄像机自适应渲染已关闭';
        return {
          xLeft: baseMetrics.xLeft,
          xRight: baseMetrics.xRight,
          yBottom: baseMetrics.yBottom,
          yTop: baseMetrics.yTop,
          centerX: baseMetrics.centerX,
          centerY: baseMetrics.centerY,
          logicalWidth: baseMetrics.logicalWidth,
          logicalHeight: baseMetrics.logicalHeight,
          adaptiveActive: false,
          capped: false
        };
      }

      if (this._isGpuZoomFreezeActive() && this._adaptiveRegion) {
        const frozen = this._adaptiveRegion;
        this._adaptiveViewportStatus = `摄像机缩放中，复用安全范围 ${frozen.logicalWidth}×${frozen.logicalHeight}，停止显存重分配`;
        return Object.assign({}, frozen, {adaptiveActive: true, capped: false, zoomFrozen: true});
      }

      const zoom = Math.max(0.01, cameraView.zoom);
      const radians = cameraView.direction * Math.PI / 180;
      const cos = Math.abs(Math.cos(radians));
      const sin = Math.abs(Math.sin(radians));
      const halfScreenW = baseMetrics.logicalWidth * 0.5 / zoom;
      const halfScreenH = baseMetrics.logicalHeight * 0.5 / zoom;
      const visibleHalfW = cos * halfScreenW + sin * halfScreenH;
      const visibleHalfH = sin * halfScreenW + cos * halfScreenH;
      const visibleLeft = cameraView.centerX - visibleHalfW;
      const visibleRight = cameraView.centerX + visibleHalfW;
      const visibleBottom = cameraView.centerY - visibleHalfH;
      const visibleTop = cameraView.centerY + visibleHalfH;

      const marginWorld = this.adaptiveViewportMarginPixels / zoom;
      const effectiveMaxScale = this.gpuZoomMemoryGuard
        ? Math.min(this.adaptiveViewportMaxScale, 4)
        : this.adaptiveViewportMaxScale;
      const maximumWidth = baseMetrics.logicalWidth * effectiveMaxScale;
      const maximumHeight = baseMetrics.logicalHeight * effectiveMaxScale;
      let desiredWidth = Math.max(
        baseMetrics.logicalWidth,
        visibleHalfW * 2 + marginWorld * 2
      );
      let desiredHeight = Math.max(
        baseMetrics.logicalHeight,
        visibleHalfH * 2 + marginWorld * 2
      );
      const capped = desiredWidth > maximumWidth + 1e-6 || desiredHeight > maximumHeight + 1e-6;
      desiredWidth = Math.min(desiredWidth, maximumWidth);
      desiredHeight = Math.min(desiredHeight, maximumHeight);

      const current = this._adaptiveRegion;
      const currentCoversVisible = Boolean(
        current &&
        visibleLeft >= current.xLeft + 0.5 &&
        visibleRight <= current.xRight - 0.5 &&
        visibleBottom >= current.yBottom + 0.5 &&
        visibleTop <= current.yTop - 0.5
      );

      if (currentCoversVisible) {
        const currentArea = current.logicalWidth * current.logicalHeight;
        const desiredArea = desiredWidth * desiredHeight;
        // 放大后保留旧的宽区域可减少反复分配；只有大到需求 3 倍以上才收缩。
        if (!(currentArea > desiredArea * 3.0 && desiredArea > 0)) {
          this._adaptiveViewportStatus = `Camera V2 自适应范围 ${current.logicalWidth}×${current.logicalHeight}，中心 (${current.centerX.toFixed(1)}, ${current.centerY.toFixed(1)})${capped ? '；已达到最大范围' : ''}`;
          return Object.assign({}, current, {adaptiveActive: true, capped});
        }
      }

      const snap = Math.max(16, Math.min(128, marginWorld * 0.5 || 16));
      let centerX = Math.round(cameraView.centerX / snap) * snap;
      let centerY = Math.round(cameraView.centerY / snap) * snap;
      let xLeft = centerX - desiredWidth * 0.5;
      let xRight = centerX + desiredWidth * 0.5;
      let yBottom = centerY - desiredHeight * 0.5;
      let yTop = centerY + desiredHeight * 0.5;

      // 快照中心不能让当前可见范围落出新区域。
      if (visibleLeft < xLeft) { const shift = visibleLeft - xLeft; xLeft += shift; xRight += shift; centerX += shift; }
      if (visibleRight > xRight) { const shift = visibleRight - xRight; xLeft += shift; xRight += shift; centerX += shift; }
      if (visibleBottom < yBottom) { const shift = visibleBottom - yBottom; yBottom += shift; yTop += shift; centerY += shift; }
      if (visibleTop > yTop) { const shift = visibleTop - yTop; yBottom += shift; yTop += shift; centerY += shift; }

      const logicalWidth = Math.max(1, Math.ceil(xRight - xLeft));
      const logicalHeight = Math.max(1, Math.ceil(yTop - yBottom));
      centerX = (xLeft + xRight) * 0.5;
      centerY = (yBottom + yTop) * 0.5;
      xLeft = centerX - logicalWidth * 0.5;
      xRight = centerX + logicalWidth * 0.5;
      yBottom = centerY - logicalHeight * 0.5;
      yTop = centerY + logicalHeight * 0.5;

      const region = {
        xLeft, xRight, yBottom, yTop,
        centerX, centerY,
        logicalWidth, logicalHeight
      };
      this._adaptiveRegion = region;
      this._adaptiveViewportStatus = `Camera V2 自适应范围 ${logicalWidth}×${logicalHeight}，中心 (${centerX.toFixed(1)}, ${centerY.toFixed(1)})${capped ? '；已达到最大范围' : ''}`;
      return Object.assign({}, region, {adaptiveActive: true, capped});
    }

    _cameraZoomFromOwnDrawables(renderer) {
      if (!renderer || !renderer._allDrawables) return NaN;
      const candidateIds = [];
      if (Number.isFinite(this._drawableId)) candidateIds.push(this._drawableId);
      if (Number.isFinite(this._clipMaskDrawableId)) candidateIds.push(this._clipMaskDrawableId);
      for (const record of this._replacementRecords.values()) {
        if (Number.isFinite(record.proxyDrawableId)) candidateIds.push(record.proxyDrawableId);
      }
      for (let i = 0; i < candidateIds.length; i++) {
        const drawable = renderer._allDrawables[candidateIds[i]];
        const cameraZoom = readCameraV2Zoom(drawable);
        if (Number.isFinite(cameraZoom) && Math.abs(cameraZoom) > 1e-9) {
          this._cameraCompatibilityStatus = `Camera V2 已检测，缩放 ${Math.abs(cameraZoom).toFixed(3)}×；超采样锚点锁定，自适应视口已启用`;
          return Math.abs(cameraZoom);
        }
        // Fallback: this extension always submits a logical 100% Drawable scale, so an
        // effective scale different from 100 is a safe camera-zoom hint for our own layers.
        const scale = readDrawableScale(drawable);
        if (scale && Number.isFinite(scale[0]) && Math.abs(scale[0]) > 1e-9) {
          const inferred = Math.abs(scale[0]) / 100;
          if (inferred > 0.01 && Math.abs(inferred - 1) > 0.01) {
            this._cameraCompatibilityStatus = `摄像机缩放已推断：${inferred.toFixed(3)}×`;
            return inferred;
          }
        }
      }
      this._cameraCompatibilityStatus = '未检测到 Camera V2，按舞台显示密度抗锯齿';
      return 1;
    }

    _computeTextureScale(renderer, logicalWidth, logicalHeight, cameraZoomOverride = NaN) {
      if (this.antiAliasQuality === 'performance') return 1;
      if (this.antiAliasQuality === 'high') return 2;
      if (this.antiAliasQuality === 'ultra') return 4;

      const cameraZoom = Number.isFinite(cameraZoomOverride) && cameraZoomOverride > 0
        ? cameraZoomOverride
        : this._cameraZoomFromOwnDrawables(renderer);
      let displayScale = 1;
      const canvas = renderer && (renderer.canvas || (renderer._gl && renderer._gl.canvas));
      if (canvas && logicalWidth > 0 && logicalHeight > 0) {
        const sx = Number.isFinite(canvas.width) ? canvas.width / logicalWidth : 1;
        const sy = Number.isFinite(canvas.height) ? canvas.height / logicalHeight : 1;
        const candidate = Math.min(Math.abs(sx || 1), Math.abs(sy || 1));
        if (Number.isFinite(candidate) && candidate > 0) displayScale = candidate;
      }
      this._detectedCameraZoom = cameraZoom;
      this._detectedDisplayScale = displayScale;

      // Physical display density is capped at 2× in auto mode to avoid making fullscreen
      // on an old computer allocate a 1920×1440 material texture. Camera zoom is allowed
      // to request up to 4× because that is where the original border jaggies become visible.
      const raw = Math.max(1, cameraZoom, Math.min(2, displayScale));
      let desired = clamp(Math.ceil(raw - 0.12), 1, 4);
      const current = Number.isFinite(this._textureScale) && this._textureScale > 0
        ? this._textureScale
        : 1;
      // Small hysteresis prevents rebuilding the Skin repeatedly when an animated camera
      // hovers close to an integer zoom boundary.
      if (desired > current && raw < current + 0.22) desired = current;
      if (desired < current && raw > current - 0.32) desired = current;
      this._textureScale = desired;
      return desired;
    }

    setBackgroundMaterial(value) {
      const raw = Cast.toString(value || '').trim().toLowerCase();
      let next = 'solid';
      if (raw === 'gaussian' || raw === 'blur' || raw === '高斯模糊') next = 'gaussian';
      else if (raw === 'glass' || raw === 'frosted' || raw === '毛玻璃') next = 'glass';
      if (this.backgroundMaterial === next) return;
      this.backgroundMaterial = next;
      this._materialFallbackReason = '';
      this.markDirty(true);
      this._requestRedraw();
    }

    setBlurSettings(radius, refreshHz) {
      this.blurRadius = clamp(finiteNumber(radius, 10), 0, 40);
      this.materialRefreshHz = clamp(finiteNumber(refreshHz, 12), 1, 30);
      this.markDirty(true);
    }

    setMaterialShadeOpacity(opacity) {
      this.materialShadeOpacity = clamp(finiteNumber(opacity, 0.18), 0, 0.85);
      this.markDirty();
    }

    retryMaterialBackend() {
      this._materialFallbackReason = '';
      this._materialBackendName = '重新检测中';
      this._materialCaptureFailures = 0;
      this._disposeBackdropResources();
      this._materialLastCaptureMs = -Infinity;
      this.markDirty(true);
      this._requestRedraw();
    }

    setGlassSettings(color, tintOpacity, saturation, noiseOpacity) {
      const nextColor = Cast.toString(color || '').trim();
      if (nextColor) this.glassTintColor = nextColor;
      this.glassTintOpacity = clamp(finiteNumber(tintOpacity, 0.22), 0, 1);
      this.glassSaturation = clamp(finiteNumber(saturation, 1.25), 0, 3);
      this.glassNoiseOpacity = clamp(finiteNumber(noiseOpacity, 0.035), 0, 0.25);
      this.markDirty(true);
    }

    getMaterialName() {
      if (this.backgroundMaterial === 'gaussian') return '高斯模糊';
      if (this.backgroundMaterial === 'glass') return '毛玻璃';
      return '纯色';
    }

    getMaterialBackendName() {
      if (this.backgroundMaterial === 'solid') return '静态 BitmapSkin';
      if (this._materialCaptureActive) return this._materialBackendName || '动态后景采样';
      if (this._materialFallbackReason) return `静态回退：${this._materialFallbackReason}`;
      return this._materialBackendName || '等待后景采样';
    }

    needsContinuousFrames() {
      const dynamicMaterial = Boolean(
        this.enabled &&
        this.backgroundMaterial !== 'solid' &&
        this.manager && this.manager.areaRecords && this.manager.areaRecords.size > 0
      );
      // 裁剪记录启用时维持轻量同步，以便克隆删除、Drawable 重建和项目
      // 重载后能够及时更新 ID；真正的裁剪仍发生在 Renderer 自己的绘制帧。
      const adaptiveCamera = Boolean(
        this.enabled && this.adaptiveViewportRendering &&
        this._lastCameraViewState && this._lastCameraViewState.detected
      );
      const activeEffects = Boolean(this.effectSystem && this.effectSystem.hasActiveEffects());
      return dynamicMaterial || this._interiorClipRecords.size > 0 || adaptiveCamera || activeEffects;
    }

    setDebugHitboxes(value) {
      this.debugHitboxes = Boolean(value);
      if (!this.debugHitboxes && !this.debugSoulCollider) this._hideDebugOverlay();
    }

    getBackendName() {
      if (this._nativeReady) return 'Scratch Renderer 原生分层';
      if (this._nativeError) return `原生 Renderer 不可用：${this._nativeError}`;
      return '等待初始化 Scratch Renderer';
    }

    _recordVisualBounds(record, out) {
      if (!record || !record.enabled || !record.shape || !record.transform || !record.transform.valid) return false;
      const params = record.shape.params || {};
      let localHalfX = 0;
      let localHalfY = 0;
      if (record.shape.type === ShapeKind.BOX) {
        const half = params.h || {x: 0, y: 0};
        localHalfX = Math.max(0, finiteNumber(half.x, 0));
        localHalfY = Math.max(0, finiteNumber(half.y, 0));
      } else if (record.shape.type === ShapeKind.CIRCLE) {
        localHalfX = localHalfY = Math.max(0, finiteNumber(params.r, 0));
      } else if (record.shape.type === ShapeKind.CAPSULE) {
        localHalfX = Math.max(0, finiteNumber(params.r, 0));
        localHalfY = Math.max(0, finiteNumber(params.hh, 0)) + localHalfX;
      } else if (record.shape.type === ShapeKind.POLYGON) {
        const vertices = Array.isArray(params.vertices) ? params.vertices : EMPTY_OBSTACLES;
        if (vertices.length < 1) return false;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < vertices.length; i++) {
          const v = vertices[i];
          if (!v) continue;
          const x = finiteNumber(v.x, 0), y = finiteNumber(v.y, 0);
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        if (!Number.isFinite(minX)) return false;
        localHalfX = Math.max(Math.abs(minX), Math.abs(maxX));
        localHalfY = Math.max(Math.abs(minY), Math.abs(maxY));
      } else return false;

      const effect = this.effectSystem
        ? this.effectSystem.getVisualTransform(record.id, this._effectScratch)
        : this._effectScratch;
      if (!this.effectSystem) {
        effect.x = 0; effect.y = 0; effect.rotation = 0; effect.scaleX = 1; effect.scaleY = 1;
      }
      const sx = Math.abs(record.transform.scaleX * clamp(finiteNumber(effect.scaleX, 1), 0.05, 20));
      const sy = Math.abs(record.transform.scaleY * clamp(finiteNumber(effect.scaleY, 1), 0.05, 20));
      const rotation = record.transform.rotation + degreesToRadians(effect.rotation);
      const cos = Math.abs(Math.cos(rotation));
      const sin = Math.abs(Math.sin(rotation));
      const halfX = cos * localHalfX * sx + sin * localHalfY * sy;
      const halfY = sin * localHalfX * sx + cos * localHalfY * sy;
      const centerX = record.transform.pos.x + finiteNumber(effect.x, 0);
      const centerY = record.transform.pos.y + finiteNumber(effect.y, 0);
      out.left = centerX - halfX;
      out.right = centerX + halfX;
      out.bottom = centerY - halfY;
      out.top = centerY + halfY;
      return true;
    }

    _computeContentWorldRegion(viewRegion) {
      // The old renderer allocated a transparent texture for the entire stage/camera
      // viewport even when the battle box occupied a small rectangle. During Tween/effects
      // that full texture was rebuilt every visual frame. Crop to the positive CSG content
      // and retain an overscan band so motion does not resize Canvas every pixel.
      if (this.debugHitboxes || this.debugSoulCollider || !this.manager || !this.manager.areaRecords) {
        this._contentRegion = null;
        this._contentCropRatio = 1;
        this._contentVisible = true;
        return Object.assign({}, viewRegion, {contentVisible: true});
      }
      const bounds = {left: Infinity, right: -Infinity, bottom: Infinity, top: -Infinity};
      const temp = {left: 0, right: 0, bottom: 0, top: 0};
      let count = 0;
      for (const record of this.manager.areaRecords.values()) {
        // A subtract node cannot expand the visible legal-region outer bounds. Its border
        // remains inside the positive union, so positive records are sufficient here.
        if (!record || !record.enabled || record.role === AreaRole.SUBTRACT) continue;
        if (!this._recordVisualBounds(record, temp)) continue;
        if (temp.left < bounds.left) bounds.left = temp.left;
        if (temp.right > bounds.right) bounds.right = temp.right;
        if (temp.bottom < bounds.bottom) bounds.bottom = temp.bottom;
        if (temp.top > bounds.top) bounds.top = temp.top;
        count++;
      }
      if (count === 0 || !Number.isFinite(bounds.left)) {
        this._contentRegion = null;
        this._contentCropRatio = 0;
        this._contentVisible = false;
        const cx = viewRegion.centerX;
        const cy = viewRegion.centerY;
        this._contentCropStatus = '无可见战斗框：使用 4×4 隐藏纹理';
        return {
          xLeft: cx - 2, xRight: cx + 2,
          yBottom: cy - 2, yTop: cy + 2,
          centerX: cx, centerY: cy,
          logicalWidth: 4, logicalHeight: 4,
          adaptiveActive: viewRegion.adaptiveActive,
          capped: viewRegion.capped,
          contentVisible: false
        };
      }
      const config = this._getPerformanceConfig();
      // Canvas width/height assignment discards the backing store and is one of the most
      // expensive operations in Chromium. Use a generous sticky envelope while animated.
      const cropOverscan = this._animationActive
        ? Math.max(72, config.cropOverscan)
        : config.cropOverscan;
      const padding = Math.max(6, this.borderWidth + cropOverscan);
      let left = Math.max(viewRegion.xLeft, bounds.left - padding);
      let right = Math.min(viewRegion.xRight, bounds.right + padding);
      let bottom = Math.max(viewRegion.yBottom, bounds.bottom - padding);
      let top = Math.min(viewRegion.yTop, bounds.top + padding);
      if (!(right > left && top > bottom)) {
        this._contentVisible = false;
        const cx = viewRegion.centerX, cy = viewRegion.centerY;
        return {
          xLeft: cx - 2, xRight: cx + 2, yBottom: cy - 2, yTop: cy + 2,
          centerX: cx, centerY: cy, logicalWidth: 4, logicalHeight: 4,
          adaptiveActive: viewRegion.adaptiveActive, capped: viewRegion.capped,
          contentVisible: false
        };
      }
      const current = this._contentRegion;
      const safe = Math.max(4, padding * 0.35);
      if (current &&
          left >= current.xLeft + safe && right <= current.xRight - safe &&
          bottom >= current.yBottom + safe && top <= current.yTop - safe) {
        const desiredArea = Math.max(1, (right - left) * (top - bottom));
        const currentArea = current.logicalWidth * current.logicalHeight;
        if (currentArea <= desiredArea * 2.5) {
          this._contentVisible = true;
          this._contentCropRatio = Math.min(1, currentArea / Math.max(1, viewRegion.logicalWidth * viewRegion.logicalHeight));
          return Object.assign({}, current, {
            adaptiveActive: viewRegion.adaptiveActive,
            capped: viewRegion.capped,
            contentVisible: true
          });
        }
      }
      const snap = 4;
      left = Math.floor(left / snap) * snap;
      right = Math.ceil(right / snap) * snap;
      bottom = Math.floor(bottom / snap) * snap;
      top = Math.ceil(top / snap) * snap;
      const logicalWidth = Math.max(4, Math.ceil(right - left));
      const logicalHeight = Math.max(4, Math.ceil(top - bottom));
      const centerX = (left + right) * 0.5;
      const centerY = (bottom + top) * 0.5;
      const region = {
        xLeft: centerX - logicalWidth * 0.5,
        xRight: centerX + logicalWidth * 0.5,
        yBottom: centerY - logicalHeight * 0.5,
        yTop: centerY + logicalHeight * 0.5,
        centerX, centerY, logicalWidth, logicalHeight
      };
      this._contentRegion = region;
      this._contentVisible = true;
      this._contentCropRatio = Math.min(1, logicalWidth * logicalHeight /
        Math.max(1, viewRegion.logicalWidth * viewRegion.logicalHeight));
      this._contentCropStatus = `内容纹理 ${logicalWidth}×${logicalHeight}，占视口 ${(this._contentCropRatio * 100).toFixed(1)}%`;
      return Object.assign({}, region, {
        adaptiveActive: viewRegion.adaptiveActive,
        capped: viewRegion.capped,
        contentVisible: true
      });
    }

    _computeStageMetrics() {
      const renderer = vm && vm.renderer;

      let baseXLeft = renderer && Number.isFinite(renderer._xLeft)
        ? renderer._xLeft
        : NaN;
      let baseXRight = renderer && Number.isFinite(renderer._xRight)
        ? renderer._xRight
        : NaN;
      let baseYBottom = renderer && Number.isFinite(renderer._yBottom)
        ? renderer._yBottom
        : NaN;
      let baseYTop = renderer && Number.isFinite(renderer._yTop)
        ? renderer._yTop
        : NaN;

      const rendererBoundsValid = (
        Number.isFinite(baseXLeft) && Number.isFinite(baseXRight) &&
        Number.isFinite(baseYBottom) && Number.isFinite(baseYTop) &&
        baseXRight - baseXLeft > 1e-9 &&
        baseYTop - baseYBottom > 1e-9
      );

      if (!rendererBoundsValid) {
        let nativeWidth = NaN;
        let nativeHeight = NaN;
        if (renderer && typeof renderer.getNativeSize === 'function') {
          try {
            const nativeSize = renderer.getNativeSize();
            if (Array.isArray(nativeSize) && nativeSize.length >= 2) {
              nativeWidth = nativeSize[0];
              nativeHeight = nativeSize[1];
            }
          } catch (error) {
            nativeWidth = NaN;
            nativeHeight = NaN;
          }
        }

        if (Number.isFinite(nativeWidth) && nativeWidth > 0 &&
            Number.isFinite(nativeHeight) && nativeHeight > 0) {
          this._fallbackStageWidth = Math.max(1, Math.round(nativeWidth));
          this._fallbackStageHeight = Math.max(1, Math.round(nativeHeight));
        } else if (!(this._fallbackStageWidth > 0) || !(this._fallbackStageHeight > 0)) {
          const runtimeWidth = runtime && Number.isFinite(runtime.stageWidth)
            ? runtime.stageWidth
            : 480;
          const runtimeHeight = runtime && Number.isFinite(runtime.stageHeight)
            ? runtime.stageHeight
            : 360;
          this._fallbackStageWidth = Math.max(1, Math.round(runtimeWidth));
          this._fallbackStageHeight = Math.max(1, Math.round(runtimeHeight));
        }

        baseXLeft = -this._fallbackStageWidth * 0.5;
        baseXRight = this._fallbackStageWidth * 0.5;
        baseYBottom = -this._fallbackStageHeight * 0.5;
        baseYTop = this._fallbackStageHeight * 0.5;
      }

      const baseLogicalWidth = Math.max(1, Math.round(baseXRight - baseXLeft));
      const baseLogicalHeight = Math.max(1, Math.round(baseYTop - baseYBottom));
      const baseCenterX = (baseXLeft + baseXRight) * 0.5;
      const baseCenterY = (baseYBottom + baseYTop) * 0.5;
      const baseMetrics = {
        xLeft: baseXLeft,
        xRight: baseXRight,
        yBottom: baseYBottom,
        yTop: baseYTop,
        centerX: baseCenterX,
        centerY: baseCenterY,
        logicalWidth: baseLogicalWidth,
        logicalHeight: baseLogicalHeight
      };

      const cameraView = this._getCameraV2ViewState(renderer);
      const viewportRegion = this._computeAdaptiveWorldRegion(baseMetrics, cameraView);
      const region = this._computeContentWorldRegion(viewportRegion);
      const xLeft = region.xLeft;
      const xRight = region.xRight;
      const yBottom = region.yBottom;
      const yTop = region.yTop;
      const logicalWidth = region.logicalWidth;
      const logicalHeight = region.logicalHeight;
      const centerX = region.centerX;
      const centerY = region.centerY;

      let requestedTextureScale;
      if (this._isGpuZoomFreezeActive() && Number.isFinite(this._textureScale) && this._textureScale > 0) {
        requestedTextureScale = this._textureScale;
      } else {
        requestedTextureScale = this._computeTextureScale(
          renderer,
          logicalWidth,
          logicalHeight,
          cameraView.detected ? cameraView.zoom : NaN
        );
      }

      // 显存安全模式同时限制纹理单边和总像素数。战斗框会维护多张同尺寸
      // Canvas（遮罩、边框、合成、染色），BitmapSkin 还会在 GPU 上持有纹理；
      // 因此不能只依赖 WebGL 常见的 4096 单边上限。
      const performanceConfig = this._getPerformanceConfig();
      requestedTextureScale = Math.min(requestedTextureScale, performanceConfig.maxTextureScale);
      if (this._animationActive) {
        requestedTextureScale = Math.min(requestedTextureScale, performanceConfig.animationTextureScale);
      }

      const maxTextureDimension = this.gpuZoomMemoryGuard
        ? this.gpuMaxTextureDimension
        : 4096;
      const logicalPixels = Math.max(1, logicalWidth * logicalHeight);
      const pixelBudget = this.gpuZoomMemoryGuard
        ? Math.max(1, Math.floor(this.gpuTextureBudgetMP * 1000000))
        : maxTextureDimension * maxTextureDimension;
      const allowedByDimension = Math.max(1, Math.floor(Math.min(
        maxTextureDimension / logicalWidth,
        maxTextureDimension / logicalHeight
      )));
      const allowedByPixels = Math.max(1, Math.floor(Math.sqrt(pixelBudget / logicalPixels)));
      const allowedScale = Math.max(1, Math.min(allowedByDimension, allowedByPixels));
      const textureScale = Math.max(1, Math.min(requestedTextureScale, allowedScale));
      this._textureScale = textureScale;

      const width = Math.max(1, Math.round(logicalWidth * textureScale));
      const height = Math.max(1, Math.round(logicalHeight * textureScale));
      this._lastGpuTexturePixels = width * height;
      this._lastGpuTextureBytes = this._lastGpuTexturePixels * 4;
      const approximateMB = this._lastGpuTextureBytes / 1048576;
      if (this._isGpuZoomFreezeActive()) {
        this._gpuMemoryGuardStatus = `摄像机缩放中：冻结 ${width}×${height} 纹理，暂停动态采样`;
      } else if (this.gpuZoomMemoryGuard) {
        const limited = textureScale < requestedTextureScale;
        this._gpuMemoryGuardStatus = `显存保护开启：单张纹理 ${width}×${height}（约 ${approximateMB.toFixed(1)} MB），预算 ${this.gpuTextureBudgetMP.toFixed(1)} MP${limited ? '；已降低超采样' : ''}`;
      } else {
        this._gpuMemoryGuardStatus = `显存保护关闭：单张纹理 ${width}×${height}（约 ${approximateMB.toFixed(1)} MB）`;
      }
      const rotationCenterX = centerX - xLeft;
      const rotationCenterY = yTop - centerY;
      const key = [
        xLeft, xRight, yBottom, yTop,
        logicalWidth, logicalHeight, textureScale, width, height,
        Math.max(64, Math.round(baseLogicalWidth * performanceConfig.captureScale)),
        Math.max(48, Math.round(baseLogicalHeight * performanceConfig.captureScale)),
        region.contentVisible === false ? 0 : 1,
        cameraView.detected ? cameraView.name : 'none'
      ].join('|');

      return {
        xLeft,
        xRight,
        yBottom,
        yTop,
        logicalWidth,
        logicalHeight,
        // 后景采样仍是当前屏幕视口，不随世界纹理扩张。合成时再用
        // Camera V2 的逆变换把屏幕图像放回自适应世界纹理的正确位置。
        captureWidth: Math.max(64, Math.round(baseLogicalWidth * performanceConfig.captureScale)),
        captureHeight: Math.max(48, Math.round(baseLogicalHeight * performanceConfig.captureScale)),
        baseXLeft,
        baseXRight,
        baseYBottom,
        baseYTop,
        baseLogicalWidth,
        baseLogicalHeight,
        width,
        height,
        textureScale,
        costumeResolution: textureScale,
        centerX,
        centerY,
        rotationCenterX,
        rotationCenterY,
        adaptiveActive: Boolean(region.adaptiveActive),
        adaptiveCapped: Boolean(region.capped),
        contentVisible: region.contentVisible !== false,
        contentCropRatio: this._contentCropRatio,
        cameraZoomFrozen: Boolean(region.zoomFrozen || this._isGpuZoomFreezeActive()),
        cameraView,
        key
      };
    }

    _getStageMetrics(force = false, nowMs = getNowMs()) {
      const now = Number.isFinite(nowMs) ? nowMs : getNowMs();
      const config = this._getPerformanceConfig();
      const adaptiveInvalidated = Boolean(
        this.adaptiveViewportRendering && this._lastCameraViewState &&
        this._lastCameraViewState.detected && !this._adaptiveRegion
      );
      const collisionVersion = this.manager ? this.manager.collisionVersion : 0;
      const effectRevision = this.effectSystem ? this.effectSystem.getRevision() : 0;
      const cacheValid = this._cachedMetrics && !force && !this._dirty &&
        !adaptiveInvalidated && !this._cameraZoomJustSettled &&
        collisionVersion === this._lastMetricsCollisionVersion &&
        effectRevision === this._lastMetricsEffectRevision &&
        now - this._lastMetricsPollMs < config.cameraPollMs;
      if (cacheValid) return this._cachedMetrics;
      const metrics = this._computeStageMetrics();
      this._cachedMetrics = metrics;
      this._lastMetricsPollMs = now;
      this._lastMetricsCollisionVersion = collisionVersion;
      this._lastMetricsEffectRevision = effectRevision;
      return metrics;
    }

    _makeCanvas(width, height) {
      if (!globalEnv.document || typeof globalEnv.document.createElement !== 'function') return null;
      const canvas = globalEnv.document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }

    _ensureBuffers(width, height, captureWidth = width, captureHeight = height) {
      const resize = (canvas) => {
        if (!canvas) return;
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
      };

      if (!this.maskCanvas) {
        this.maskCanvas = this._makeCanvas(width, height);
        this.maskContext = this.maskCanvas && this.maskCanvas.getContext('2d');
      }
      if (!this.tintCanvas) {
        this.tintCanvas = this._makeCanvas(width, height);
        this.tintContext = this.tintCanvas && this.tintCanvas.getContext('2d');
      }
      if (!this.borderCanvas) {
        this.borderCanvas = this._makeCanvas(width, height);
        this.borderContext = this.borderCanvas && this.borderCanvas.getContext('2d');
      }
      if (!this.cacheCanvas) {
        this.cacheCanvas = this._makeCanvas(width, height);
        this.cacheContext = this.cacheCanvas && this.cacheCanvas.getContext('2d');
      }
      if (!this.captureCanvas) {
        this.captureCanvas = this._makeCanvas(width, height);
        this.captureContext = this.captureCanvas && this.captureCanvas.getContext('2d');
      }
      if (!this.blurCanvas) {
        this.blurCanvas = this._makeCanvas(width, height);
        this.blurContext = this.blurCanvas && this.blurCanvas.getContext('2d');
      }
      if (!this.blurWorkCanvas) {
        this.blurWorkCanvas = this._makeCanvas(Math.max(1, Math.ceil(width / 4)), Math.max(1, Math.ceil(height / 4)));
        this.blurWorkContext = this.blurWorkCanvas && this.blurWorkCanvas.getContext('2d');
      }
      if (!this.noiseCanvas) {
        this.noiseCanvas = this._makeCanvas(64, 64);
        this.noiseContext = this.noiseCanvas && this.noiseCanvas.getContext('2d');
        this._buildNoiseTexture();
      }

      resize(this.maskCanvas);
      resize(this.tintCanvas);
      resize(this.borderCanvas);
      resize(this.cacheCanvas);
      if (this.captureCanvas) {
        if (this.captureCanvas.width !== captureWidth) this.captureCanvas.width = captureWidth;
        if (this.captureCanvas.height !== captureHeight) this.captureCanvas.height = captureHeight;
      }
      if (this.blurCanvas) {
        if (this.blurCanvas.width !== captureWidth) this.blurCanvas.width = captureWidth;
        if (this.blurCanvas.height !== captureHeight) this.blurCanvas.height = captureHeight;
      }
      if (this.blurWorkCanvas) {
        const workScale = Math.max(2, Math.min(8, Math.round(2 + this.blurRadius / 6)));
        const workWidth = Math.max(1, Math.ceil(captureWidth / workScale));
        const workHeight = Math.max(1, Math.ceil(captureHeight / workScale));
        if (this.blurWorkCanvas.width !== workWidth) this.blurWorkCanvas.width = workWidth;
        if (this.blurWorkCanvas.height !== workHeight) this.blurWorkCanvas.height = workHeight;
      }
      return Boolean(
        this.maskContext && this.tintContext && this.borderContext &&
        this.cacheContext && this.captureContext && this.blurContext &&
        this.blurWorkContext
      );
    }

    _beginRecordPath(ctx, record, metrics) {
      if (!record || !record.shape || !record.transform) return false;
      const transform = record.transform;
      if (!transform.valid) return false;

      const textureScale = Number.isFinite(metrics.textureScale) ? metrics.textureScale : 1;
      const effect = this.effectSystem
        ? this.effectSystem.getVisualTransform(record.id, this._effectScratch)
        : this._effectScratch;
      if (!this.effectSystem) {
        effect.x = 0; effect.y = 0; effect.rotation = 0; effect.scaleX = 1; effect.scaleY = 1;
      }
      const visualX = transform.pos.x + finiteNumber(effect.x, 0);
      const visualY = transform.pos.y + finiteNumber(effect.y, 0);
      const visualRotation = transform.rotation + degreesToRadians(effect.rotation);
      const visualScaleX = transform.scaleX * clamp(finiteNumber(effect.scaleX, 1), 0.05, 20);
      const visualScaleY = transform.scaleY * clamp(finiteNumber(effect.scaleY, 1), 0.05, 20);
      this._lastPathScaleMin = Math.max(0.000001, Math.min(Math.abs(visualScaleX), Math.abs(visualScaleY)));
      ctx.save();
      ctx.translate(
        (visualX - metrics.xLeft) * textureScale,
        (metrics.yTop - visualY) * textureScale
      );
      ctx.rotate(-visualRotation);
      ctx.scale(visualScaleX * textureScale, -visualScaleY * textureScale);
      ctx.beginPath();

      const shape = record.shape;
      const params = shape.params || {};
      switch (shape.type) {
        case ShapeKind.BOX: {
          const half = params.h || {x: 0, y: 0};
          const hx = Math.max(0, finiteNumber(half.x, 0));
          const hy = Math.max(0, finiteNumber(half.y, 0));
          const radius = clamp(Math.max(0, finiteNumber(params.r, 0)), 0, Math.min(hx, hy));
          const x = -hx;
          const y = -hy;
          const boxWidth = hx * 2;
          const boxHeight = hy * 2;
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, boxWidth, boxHeight, radius);
          } else {
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + boxWidth - radius, y);
            ctx.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + radius);
            ctx.lineTo(x + boxWidth, y + boxHeight - radius);
            ctx.quadraticCurveTo(x + boxWidth, y + boxHeight, x + boxWidth - radius, y + boxHeight);
            ctx.lineTo(x + radius, y + boxHeight);
            ctx.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
          }
          break;
        }
        case ShapeKind.CIRCLE: {
          const radius = Math.max(0, finiteNumber(params.r, 0));
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          break;
        }
        case ShapeKind.CAPSULE: {
          const halfHeight = Math.max(0, finiteNumber(params.hh, 0));
          const radius = Math.max(0, finiteNumber(params.r, 0));
          ctx.moveTo(-radius, -halfHeight);
          ctx.arc(0, -halfHeight, radius, Math.PI, 0, false);
          ctx.lineTo(radius, halfHeight);
          ctx.arc(0, halfHeight, radius, 0, Math.PI, false);
          ctx.closePath();
          break;
        }
        case ShapeKind.POLYGON: {
          const vertices = Array.isArray(params.vertices) ? params.vertices : EMPTY_OBSTACLES;
          if (vertices.length < 3) {
            ctx.restore();
            return false;
          }
          ctx.moveTo(vertices[0].x, vertices[0].y);
          for (let i = 1; i < vertices.length; i++) {
            ctx.lineTo(vertices[i].x, vertices[i].y);
          }
          ctx.closePath();
          break;
        }
        default:
          ctx.restore();
          return false;
      }
      return true;
    }

    _fillRecord(ctx, record, metrics) {
      if (!this._beginRecordPath(ctx, record, metrics)) return;
      ctx.fill();
      ctx.restore();
    }

    _strokeRecord(ctx, record, metrics, fillStyle, strokeStyle) {
      if (!this._beginRecordPath(ctx, record, metrics)) return;
      ctx.fillStyle = fillStyle;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = 1.5 / Math.max(
        0.000001,
        Math.min(Math.abs(record.transform.scaleX), Math.abs(record.transform.scaleY))
      );
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    _tintMask(targetCtx, width, height, color, opacity = 1) {
      targetCtx.clearRect(0, 0, width, height);
      targetCtx.globalCompositeOperation = 'source-over';
      targetCtx.globalAlpha = 1;
      targetCtx.drawImage(this.maskCanvas, 0, 0);
      targetCtx.globalCompositeOperation = 'source-in';
      targetCtx.globalAlpha = clamp(opacity, 0, 1);
      targetCtx.fillStyle = color;
      targetCtx.fillRect(0, 0, width, height);
      targetCtx.globalCompositeOperation = 'source-over';
      targetCtx.globalAlpha = 1;
    }

    _buildNoiseTexture() {
      const ctx = this.noiseContext;
      const canvas = this.noiseCanvas;
      if (!ctx || !canvas) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 固定种子的细颗粒，避免每帧随机造成纹理闪烁与额外 GC。
      let seed = 0x51f15e;
      for (let i = 0; i < 768; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const x = seed % canvas.width;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const y = seed % canvas.height;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const alpha = 0.08 + ((seed & 255) / 255) * 0.16;
        ctx.fillStyle = (seed & 256)
          ? `rgba(255,255,255,${alpha})`
          : `rgba(0,0,0,${alpha})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    _buildStaticLayers(metrics) {
      const width = metrics.width;
      const height = metrics.height;
      if (!this._ensureBuffers(width, height, metrics.captureWidth, metrics.captureHeight)) return false;
      const mask = this.maskContext;
      const borderCtx = this.borderContext;

      mask.setTransform(1, 0, 0, 1, 0, 0);
      mask.globalAlpha = 1;
      mask.globalCompositeOperation = 'source-over';
      mask.clearRect(0, 0, width, height);
      mask.fillStyle = '#ffffff';

      for (const record of this.manager.areaRecords.values()) {
        if (!record.enabled || record.role === AreaRole.SUBTRACT) continue;
        mask.globalCompositeOperation = 'source-over';
        this._fillRecord(mask, record, metrics);
      }
      for (const record of this.manager.areaRecords.values()) {
        if (!record.enabled || record.role !== AreaRole.SUBTRACT) continue;
        mask.globalCompositeOperation = 'destination-out';
        this._fillRecord(mask, record, metrics);
      }
      mask.globalCompositeOperation = 'source-over';

      borderCtx.setTransform(1, 0, 0, 1, 0, 0);
      borderCtx.globalAlpha = 1;
      borderCtx.globalCompositeOperation = 'source-over';
      borderCtx.clearRect(0, 0, width, height);

      const textureScale = Number.isFinite(metrics.textureScale) ? metrics.textureScale : 1;
      borderCtx.strokeStyle = this.borderColor;
      borderCtx.lineJoin = 'round';
      borderCtx.lineCap = 'round';
      let borderDrawCalls = 0;
      for (const record of this.manager.areaRecords.values()) {
        if (!record || !record.enabled) continue;
        if (!this._beginRecordPath(borderCtx, record, metrics)) continue;
        // Canvas stroke is centered on the vector path. Drawing at twice the requested
        // width and subtracting the final legal mask leaves a crisp outside-only border.
        borderCtx.lineWidth = (this.borderWidth * 2) / Math.max(0.000001, this._lastPathScaleMin || 1);
        borderCtx.stroke();
        borderCtx.restore();
        borderDrawCalls++;
      }
      this._borderDrawCallsLast = borderDrawCalls;
      this._borderDrawCallsTotal += borderDrawCalls;
      borderCtx.globalCompositeOperation = 'destination-out';
      borderCtx.drawImage(this.maskCanvas, 0, 0);
      borderCtx.globalCompositeOperation = 'source-over';
      borderCtx.globalAlpha = 1;

      this._dirty = false;
      this._lastBuildPixels = width * height;
      this._staticBuildCount++;
      return true;
    }

    _drawColorInsideMask(targetCtx, width, height, color, opacity) {
      if (!(opacity > 0)) return;
      this._tintMask(this.tintContext, width, height, color, opacity);
      targetCtx.drawImage(this.tintCanvas, 0, 0);
    }

    _drawImageInsideMask(targetCtx, sourceCanvas, width, height, metrics) {
      if (!targetCtx || !sourceCanvas) return;
      targetCtx.save();
      targetCtx.globalCompositeOperation = 'source-over';
      targetCtx.globalAlpha = 1;
      targetCtx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in targetCtx) targetCtx.imageSmoothingQuality = 'high';

      const camera = metrics && metrics.cameraView;
      if (metrics && metrics.adaptiveActive && camera && camera.detected) {
        // sourceCanvas 是 Camera V2 已变换后的“当前屏幕”。把屏幕像素通过
        // 相机逆矩阵放回世界纹理，之后该 BitmapSkin 再由 Camera V2 正向变换，
        // 最终毛玻璃/高斯背景会与屏幕下方内容对齐。
        const zoom = Math.abs(camera.signedZoom) > 1e-9 ? camera.signedZoom : 1;
        const radians = camera.direction * Math.PI / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const textureScale = metrics.textureScale || 1;
        const baseXLeft = metrics.baseXLeft;
        const baseYTop = metrics.baseYTop;
        const sourceScaleX = metrics.baseLogicalWidth / Math.max(1, sourceCanvas.width);
        const sourceScaleY = metrics.baseLogicalHeight / Math.max(1, sourceCanvas.height);
        const a = textureScale * cos * sourceScaleX / zoom;
        const b = textureScale * sin * sourceScaleX / zoom;
        const c = -textureScale * sin * sourceScaleY / zoom;
        const d = textureScale * cos * sourceScaleY / zoom;
        const e = textureScale / zoom * (cos * baseXLeft + sin * baseYTop) -
          textureScale * (camera.offsetX + metrics.xLeft);
        const f = textureScale / zoom * (sin * baseXLeft - cos * baseYTop) +
          textureScale * (camera.offsetY + metrics.yTop);
        targetCtx.setTransform(a, b, c, d, e, f);
        targetCtx.drawImage(sourceCanvas, 0, 0);
      } else {
        targetCtx.drawImage(sourceCanvas, 0, 0, width, height);
      }
      targetCtx.restore();

      targetCtx.save();
      targetCtx.setTransform(1, 0, 0, 1, 0, 0);
      targetCtx.globalCompositeOperation = 'destination-in';
      targetCtx.globalAlpha = 1;
      targetCtx.drawImage(this.maskCanvas, 0, 0, width, height);
      targetCtx.restore();
      targetCtx.globalCompositeOperation = 'source-over';
      targetCtx.globalAlpha = 1;
    }

    _composeMaterial(targetCanvas, targetCtx, metrics, backdropReady) {
      if (!targetCanvas || !targetCtx) return false;
      const width = metrics.width;
      const height = metrics.height;
      if (targetCanvas.width !== width) targetCanvas.width = width;
      if (targetCanvas.height !== height) targetCanvas.height = height;

      targetCtx.setTransform(1, 0, 0, 1, 0, 0);
      targetCtx.globalAlpha = 1;
      targetCtx.globalCompositeOperation = 'source-over';
      targetCtx.clearRect(0, 0, width, height);

      const dynamicMode = this.backgroundMaterial !== 'solid';
      if (dynamicMode && backdropReady) {
        this._drawImageInsideMask(targetCtx, this.blurCanvas, width, height, metrics);
      } else {
        // 宿主不暴露私有绘制接口时仍保持可用，不让框体消失。
        const fallbackOpacity = dynamicMode
          ? Math.max(this.materialShadeOpacity, this.backgroundMaterial === 'glass' ? 0.16 : 0.32)
          : this.fillOpacity;
        const fallbackColor = this.backgroundMaterial === 'glass'
          ? this.glassTintColor
          : this.fillColor;
        this._drawColorInsideMask(targetCtx, width, height, fallbackColor, fallbackOpacity);
      }

      if (dynamicMode && backdropReady) {
        // 动态材质使用独立暗度，避免旧项目的 100% 黑底把模糊彻底覆盖。
        this._drawColorInsideMask(
          targetCtx,
          width,
          height,
          this.fillColor,
          this.materialShadeOpacity
        );
      }

      if (this.backgroundMaterial === 'glass') {
        this._drawColorInsideMask(
          targetCtx,
          width,
          height,
          this.glassTintColor,
          this.glassTintOpacity
        );

        // 轻微斜向高光，让毛玻璃区别于单纯的高斯模糊。
        if (typeof targetCtx.createLinearGradient === 'function') {
          const gradient = targetCtx.createLinearGradient(0, 0, width, height);
          gradient.addColorStop(0, 'rgba(255,255,255,0.16)');
          gradient.addColorStop(0.42, 'rgba(255,255,255,0.035)');
          gradient.addColorStop(1, 'rgba(255,255,255,0)');
          this._tintMask(this.tintContext, width, height, '#ffffff', 1);
          this.tintContext.globalCompositeOperation = 'source-in';
          this.tintContext.fillStyle = gradient;
          this.tintContext.fillRect(0, 0, width, height);
          this.tintContext.globalCompositeOperation = 'source-over';
          targetCtx.drawImage(this.tintCanvas, 0, 0);
        }

        if (this.glassNoiseOpacity > 0 && this.noiseCanvas && typeof targetCtx.createPattern === 'function') {
          const pattern = targetCtx.createPattern(this.noiseCanvas, 'repeat');
          if (pattern) {
            targetCtx.save();
            targetCtx.globalAlpha = this.glassNoiseOpacity;
            targetCtx.fillStyle = pattern;
            targetCtx.fillRect(0, 0, width, height);
            targetCtx.globalCompositeOperation = 'destination-in';
            targetCtx.globalAlpha = 1;
            targetCtx.drawImage(this.maskCanvas, 0, 0);
            targetCtx.restore();
          }
        }
      }

      // 边框始终最后绘制，保持锐利，不参与模糊。
      targetCtx.globalCompositeOperation = 'source-over';
      targetCtx.globalAlpha = 1;
      targetCtx.drawImage(this.borderCanvas, 0, 0);
      return true;
    }

    _nativeBackdropApiAvailable(renderer) {
      return Boolean(
        renderer && renderer._gl &&
        Array.isArray(renderer._drawList) &&
        renderer._projection &&
        typeof renderer._drawThese === 'function'
      );
    }

    _queryFramebufferAvailable(renderer, width, height) {
      const info = renderer && renderer._queryBufferInfo;
      if (!info || !info.framebuffer) return false;
      const infoWidth = Number.isFinite(info.width) ? info.width : width;
      const infoHeight = Number.isFinite(info.height) ? info.height : height;
      return infoWidth === width && infoHeight === height;
    }

    _disposeBackdropResources() {
      const renderer = this._renderer || (vm && vm.renderer);
      const gl = renderer && renderer._gl;
      if (gl) {
        try {
          if (this._captureFramebuffer && typeof gl.deleteFramebuffer === 'function') {
            gl.deleteFramebuffer(this._captureFramebuffer);
          }
          if (this._captureTexture && typeof gl.deleteTexture === 'function') {
            gl.deleteTexture(this._captureTexture);
          }
        } catch (error) {
          // WebGL 上下文可能已被宿主销毁。
        }
      }
      this._captureFramebuffer = null;
      this._captureTexture = null;
      this._captureWidth = 0;
      this._captureHeight = 0;
      this._capturePixels = null;
      this._captureImageData = null;
    }

    _ensureBackdropResources(renderer, width, height) {
      if (!this._nativeBackdropApiAvailable(renderer)) return false;
      if (
        this._captureFramebuffer && this._captureTexture &&
        this._captureWidth === width && this._captureHeight === height &&
        this._capturePixels && this._captureImageData
      ) return true;

      this._disposeBackdropResources();
      const gl = renderer._gl;
      try {
        const framebuffer = gl.createFramebuffer();
        const texture = gl.createTexture();
        if (!framebuffer || !texture) throw new Error('无法创建后景采样缓冲区');

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA,
          width, height, 0,
          gl.RGBA, gl.UNSIGNED_BYTE, null
        );

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          texture,
          0
        );
        if (typeof gl.checkFramebufferStatus === 'function') {
          const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
          if (status !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error(`后景采样 Framebuffer 不完整：${status}`);
          }
        }

        this._captureFramebuffer = framebuffer;
        this._captureTexture = texture;
        this._captureWidth = width;
        this._captureHeight = height;
        this._capturePixels = new Uint8Array(width * height * 4);
        if (this.captureContext && typeof this.captureContext.createImageData === 'function') {
          this._captureImageData = this.captureContext.createImageData(width, height);
        } else if (typeof globalEnv.ImageData === 'function') {
          this._captureImageData = new globalEnv.ImageData(width, height);
        } else {
          throw new Error('宿主不支持 ImageData');
        }
        return true;
      } catch (error) {
        this._materialFallbackReason = error && error.message ? error.message : Cast.toString(error);
        this._disposeBackdropResources();
        return false;
      } finally {
        try {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.bindTexture(gl.TEXTURE_2D, null);
        } catch (error) {
          // no-op
        }
      }
    }

    _collectBackdropDrawables(renderer, cutoffDrawableId) {
      const drawList = renderer._drawList;
      let cutoff = Number.isFinite(cutoffDrawableId)
        ? drawList.indexOf(cutoffDrawableId)
        : drawList.length;
      if (cutoff < 0) cutoff = drawList.length;

      const excluded = new Set();
      if (Number.isFinite(this._drawableId)) excluded.add(this._drawableId);
      for (const record of this._replacementRecords.values()) {
        if (Number.isFinite(record.proxyDrawableId)) excluded.add(record.proxyDrawableId);
      }

      const ids = this._captureCandidateIds;
      ids.length = 0;
      for (let i = 0; i < cutoff; i++) {
        const id = drawList[i];
        if (!excluded.has(id)) ids.push(id);
      }
      return ids;
    }

    _capturePixelsFromBoundFramebuffer(renderer, metrics, drawables) {
      const gl = renderer._gl;
      const width = metrics.captureWidth || metrics.logicalWidth || metrics.width;
      const height = metrics.captureHeight || metrics.logicalHeight || metrics.height;
      const bg = renderer._backgroundColor4f || [1, 1, 1, 1];

      // 清除之前遗留的 GL 错误，避免把宿主的旧错误误判为本次采样失败。
      if (typeof gl.getError === 'function') {
        let guard = 0;
        while (gl.getError() !== gl.NO_ERROR && guard++ < 16) {}
      }

      if (typeof renderer._doExitDrawRegion === 'function') renderer._doExitDrawRegion();
      gl.viewport(0, 0, width, height);
      if (typeof gl.disable === 'function' && gl.STENCIL_TEST !== undefined) gl.disable(gl.STENCIL_TEST);
      if (typeof gl.colorMask === 'function') gl.colorMask(true, true, true, true);
      gl.clearColor(bg[0], bg[1], bg[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      renderer._drawThese(
        drawables,
        'default',
        renderer._projection,
        {framebufferWidth: width, framebufferHeight: height}
      );
      if (typeof renderer._doExitDrawRegion === 'function') renderer._doExitDrawRegion();

      gl.readPixels(
        0, 0, width, height,
        gl.RGBA, gl.UNSIGNED_BYTE,
        this._capturePixels
      );

      if (typeof gl.getError === 'function') {
        const errorCode = gl.getError();
        if (errorCode !== gl.NO_ERROR) throw new Error(`readPixels WebGL 错误：${errorCode}`);
      }

      const source = this._capturePixels;
      const destination = this._captureImageData.data;
      const stride = width * 4;
      for (let y = 0; y < height; y++) {
        const sourceStart = (height - 1 - y) * stride;
        destination.set(source.subarray(sourceStart, sourceStart + stride), y * stride);
      }
      this.captureContext.putImageData(this._captureImageData, 0, 0);
      this._buildBlurredBackdrop(width, height);
      return true;
    }

    _ensureGaussianBuffers(width, height) {
      const pixelCount = width * height;
      const channelCount = pixelCount * 4;
      if (!this._gaussianTemp || this._gaussianTemp.length !== channelCount) {
        this._gaussianTemp = new Float32Array(channelCount);
      }
      if (!this._gaussianOutput || this._gaussianOutput.length !== channelCount) {
        this._gaussianOutput = new Uint8ClampedArray(channelCount);
      }
      if (
        !this._gaussianImageData ||
        this._gaussianImageData.width !== width ||
        this._gaussianImageData.height !== height
      ) {
        this._gaussianImageData = this.blurContext.createImageData(width, height);
      }
      if (!this._boxBlurTemp || this._boxBlurTemp.length !== channelCount) {
        this._boxBlurTemp = new Uint8ClampedArray(channelCount);
      }
      if (!this._boxBlurOutput || this._boxBlurOutput.length !== channelCount) {
        this._boxBlurOutput = new Uint8ClampedArray(channelCount);
      }
    }

    _getGaussianKernel(radius) {
      const safeRadius = Math.max(0.01, finiteNumber(radius, 0));
      // “模糊半径”作为视觉强度，sigma 稍小可保持毛玻璃轮廓而不发灰。
      const sigma = Math.max(0.45, safeRadius * 0.55);
      const kernelRadius = Math.max(1, Math.min(28, Math.ceil(sigma * 3)));
      const key = `${kernelRadius}:${sigma.toFixed(4)}`;
      if (this._gaussianKernel && this._gaussianKernelKey === key) {
        return this._gaussianKernel;
      }
      const size = kernelRadius * 2 + 1;
      const kernel = new Float32Array(size);
      const twoSigmaSq = 2 * sigma * sigma;
      let sum = 0;
      for (let i = -kernelRadius; i <= kernelRadius; i++) {
        const value = Math.exp(-(i * i) / twoSigmaSq);
        kernel[i + kernelRadius] = value;
        sum += value;
      }
      const inv = sum > 0 ? 1 / sum : 1;
      for (let i = 0; i < size; i++) kernel[i] *= inv;
      kernel.radius = kernelRadius;
      this._gaussianKernel = kernel;
      this._gaussianKernelKey = key;
      return kernel;
    }

    _applySaturationRGBA(data, saturation) {
      if (!data || Math.abs(saturation - 1) <= 0.0001) return;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
        data[i] = clamp(Math.round(luminance + (r - luminance) * saturation), 0, 255);
        data[i + 1] = clamp(Math.round(luminance + (g - luminance) * saturation), 0, 255);
        data[i + 2] = clamp(Math.round(luminance + (b - luminance) * saturation), 0, 255);
      }
    }

    _applyExactSeparableGaussian(width, height, radius, saturation) {
      this._ensureGaussianBuffers(width, height);
      const source = this._captureImageData.data;
      const temp = this._gaussianTemp;
      const output = this._gaussianOutput;
      const kernel = this._getGaussianKernel(radius);
      const kr = kernel.radius || ((kernel.length - 1) >> 1);

      // 水平方向卷积。边缘使用 clamp-to-edge，避免透明黑边渗入。
      for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          let sr = 0, sg = 0, sb = 0, sa = 0;
          for (let k = -kr; k <= kr; k++) {
            const sx = Math.max(0, Math.min(width - 1, x + k));
            const sourceIndex = (row + sx) * 4;
            const weight = kernel[k + kr];
            sr += source[sourceIndex] * weight;
            sg += source[sourceIndex + 1] * weight;
            sb += source[sourceIndex + 2] * weight;
            sa += source[sourceIndex + 3] * weight;
          }
          const targetIndex = (row + x) * 4;
          temp[targetIndex] = sr;
          temp[targetIndex + 1] = sg;
          temp[targetIndex + 2] = sb;
          temp[targetIndex + 3] = sa;
        }
      }

      // 垂直方向卷积。
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let sr = 0, sg = 0, sb = 0, sa = 0;
          for (let k = -kr; k <= kr; k++) {
            const sy = Math.max(0, Math.min(height - 1, y + k));
            const sourceIndex = (sy * width + x) * 4;
            const weight = kernel[k + kr];
            sr += temp[sourceIndex] * weight;
            sg += temp[sourceIndex + 1] * weight;
            sb += temp[sourceIndex + 2] * weight;
            sa += temp[sourceIndex + 3] * weight;
          }
          const targetIndex = (y * width + x) * 4;
          output[targetIndex] = sr;
          output[targetIndex + 1] = sg;
          output[targetIndex + 2] = sb;
          output[targetIndex + 3] = sa;
        }
      }

      this._applySaturationRGBA(output, saturation);
      this._gaussianImageData.data.set(output);
      this.blurContext.putImageData(this._gaussianImageData, 0, 0);
      this._blurAlgorithmName = `全分辨率可分离高斯（核 ${kernel.length}）`;
    }

    _boxBlurPass(source, target, width, height, radius, horizontal) {
      const r = Math.max(1, Math.floor(radius));
      const diameter = r * 2 + 1;
      if (horizontal) {
        for (let y = 0; y < height; y++) {
          const row = y * width;
          let sr = 0, sg = 0, sb = 0, sa = 0;
          for (let k = -r; k <= r; k++) {
            const x = Math.max(0, Math.min(width - 1, k));
            const index = (row + x) * 4;
            sr += source[index]; sg += source[index + 1]; sb += source[index + 2]; sa += source[index + 3];
          }
          for (let x = 0; x < width; x++) {
            const out = (row + x) * 4;
            target[out] = sr / diameter;
            target[out + 1] = sg / diameter;
            target[out + 2] = sb / diameter;
            target[out + 3] = sa / diameter;
            const removeX = Math.max(0, x - r);
            const addX = Math.min(width - 1, x + r + 1);
            const remove = (row + removeX) * 4;
            const add = (row + addX) * 4;
            sr += source[add] - source[remove];
            sg += source[add + 1] - source[remove + 1];
            sb += source[add + 2] - source[remove + 2];
            sa += source[add + 3] - source[remove + 3];
          }
        }
      } else {
        for (let x = 0; x < width; x++) {
          let sr = 0, sg = 0, sb = 0, sa = 0;
          for (let k = -r; k <= r; k++) {
            const y = Math.max(0, Math.min(height - 1, k));
            const index = (y * width + x) * 4;
            sr += source[index]; sg += source[index + 1]; sb += source[index + 2]; sa += source[index + 3];
          }
          for (let y = 0; y < height; y++) {
            const out = (y * width + x) * 4;
            target[out] = sr / diameter;
            target[out + 1] = sg / diameter;
            target[out + 2] = sb / diameter;
            target[out + 3] = sa / diameter;
            const removeY = Math.max(0, y - r);
            const addY = Math.min(height - 1, y + r + 1);
            const remove = (removeY * width + x) * 4;
            const add = (addY * width + x) * 4;
            sr += source[add] - source[remove];
            sg += source[add + 1] - source[remove + 1];
            sb += source[add + 2] - source[remove + 2];
            sa += source[add + 3] - source[remove + 3];
          }
        }
      }
    }

    _applyLargeRadiusGaussianApproximation(width, height, radius, saturation) {
      this._ensureGaussianBuffers(width, height);
      const source = this._captureImageData.data;
      const a = this._boxBlurTemp;
      const b = this._boxBlurOutput;
      a.set(source);
      // 四次全分辨率 box blur，使用滑动窗口 O(N)，视觉上接近大 sigma 高斯，
      // 与旧版“先缩小再放大”不同，不会产生任何分块阶梯。
      const passRadius = Math.max(2, Math.round(radius * 0.42));
      for (let pass = 0; pass < 4; pass++) {
        this._boxBlurPass(a, b, width, height, passRadius, true);
        this._boxBlurPass(b, a, width, height, passRadius, false);
      }
      this._applySaturationRGBA(a, saturation);
      this._gaussianImageData.data.set(a);
      this.blurContext.putImageData(this._gaussianImageData, 0, 0);
      this._blurAlgorithmName = `全分辨率四次高斯近似（半径 ${passRadius}）`;
    }

    _buildBlurredBackdrop(width, height) {
      const blur = this.blurContext;
      const radius = clamp(this.blurRadius, 0, 40);
      const saturation = this.backgroundMaterial === 'glass'
        ? clamp(this.glassSaturation, 0, 3)
        : 1;

      blur.setTransform(1, 0, 0, 1, 0, 0);
      blur.globalAlpha = 1;
      blur.globalCompositeOperation = 'source-over';
      blur.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in blur) blur.imageSmoothingQuality = 'high';
      blur.clearRect(0, 0, width, height);

      if (radius <= 0.01) {
        blur.drawImage(this.captureCanvas, 0, 0, width, height);
        this._blurAlgorithmName = '无模糊（原分辨率）';
        return;
      }

      const performanceConfig = this._getPerformanceConfig();
      if (performanceConfig.useCanvasFilterBlur && 'filter' in blur) {
        const pad = Math.max(2, Math.ceil(radius * 1.5));
        try {
          blur.save();
          blur.filter = `blur(${Math.max(0.5, radius)}px) saturate(${Math.max(0, saturation)})`;
          blur.drawImage(this.captureCanvas, -pad, -pad, width + pad * 2, height + pad * 2);
          blur.restore();
          blur.filter = 'none';
          this._blurAlgorithmName = `Canvas2D 高斯（${width}×${height}，半径 ${radius.toFixed(1)}）`;
          return;
        } catch (error) {
          try { blur.restore(); } catch (ignored) {}
          blur.filter = 'none';
        }
      }
      // High-quality mode retains the exact CPU convolution; other hosts fall back to
      // the O(N) approximation if Canvas2D filter is unavailable.
      if (!performanceConfig.useCanvasFilterBlur && radius <= 16) {
        this._applyExactSeparableGaussian(width, height, radius, saturation);
      } else {
        this._applyLargeRadiusGaussianApproximation(width, height, radius, saturation);
      }
    }

    _captureBackdropWithQueryBuffer(renderer, metrics, drawables) {
      const gl = renderer._gl;
      if (!this._queryFramebufferAvailable(renderer, metrics.captureWidth, metrics.captureHeight)) {
        throw new Error('Renderer 查询缓冲区不可用或尺寸不匹配');
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, renderer._queryBufferInfo.framebuffer);
      return this._capturePixelsFromBoundFramebuffer(renderer, metrics, drawables);
    }

    _captureBackdropWithCustomFramebuffer(renderer, metrics, drawables) {
      if (!this._ensureBackdropResources(renderer, metrics.captureWidth, metrics.captureHeight)) {
        throw new Error(this._materialFallbackReason || '无法创建自建 FBO');
      }
      renderer._gl.bindFramebuffer(renderer._gl.FRAMEBUFFER, this._captureFramebuffer);
      return this._capturePixelsFromBoundFramebuffer(renderer, metrics, drawables);
    }

    _captureBackdrop(renderer, metrics, cutoffDrawableId) {
      this._materialCaptureActive = false;
      if (!this._nativeBackdropApiAvailable(renderer)) {
        this._materialBackendName = '不可用';
        this._materialFallbackReason = '宿主未暴露 _drawThese/_projection 后景绘制接口';
        return false;
      }

      if (!this._ensureBuffers(
        metrics.width,
        metrics.height,
        metrics.captureWidth,
        metrics.captureHeight
      )) {
        this._materialBackendName = '不可用';
        this._materialFallbackReason = '无法创建材质 Canvas';
        return false;
      }

      // 后景采样保持逻辑舞台分辨率；最终只在合成阶段高质量放大。
      // 这样边框可以超采样，同时不会让旧电脑承担 4× 高斯卷积成本。
      const captureWidth = metrics.captureWidth;
      const captureHeight = metrics.captureHeight;
      const pixelCount = captureWidth * captureHeight * 4;
      if (!this._capturePixels || this._capturePixels.length !== pixelCount) {
        this._capturePixels = new Uint8Array(pixelCount);
      }
      if (!this._captureImageData || this._captureImageData.width !== captureWidth || this._captureImageData.height !== captureHeight) {
        if (this.captureContext && typeof this.captureContext.createImageData === 'function') {
          this._captureImageData = this.captureContext.createImageData(captureWidth, captureHeight);
        } else if (typeof globalEnv.ImageData === 'function') {
          this._captureImageData = new globalEnv.ImageData(captureWidth, captureHeight);
        } else {
          this._materialBackendName = '不可用';
          this._materialFallbackReason = '宿主不支持 ImageData';
          return false;
        }
      }

      const gl = renderer._gl;
      const drawables = this._collectBackdropDrawables(renderer, cutoffDrawableId);
      const bg = renderer._backgroundColor4f || [1, 1, 1, 1];
      let oldFramebuffer = null;
      let oldViewport = null;
      let oldClearColor = null;
      try {
        if (typeof gl.getParameter === 'function') {
          if (gl.FRAMEBUFFER_BINDING !== undefined) oldFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
          if (gl.VIEWPORT !== undefined) oldViewport = gl.getParameter(gl.VIEWPORT);
          if (gl.COLOR_CLEAR_VALUE !== undefined) oldClearColor = gl.getParameter(gl.COLOR_CLEAR_VALUE);
        }
      } catch (error) {}

      const failures = [];
      try {
        try {
          if (this._captureBackdropWithQueryBuffer(renderer, metrics, drawables)) {
            this._materialBackendName = 'Renderer 原生查询缓冲区';
            this._materialFallbackReason = '';
            this._materialCaptureActive = true;
            this._materialCaptureFailures = 0;
            return true;
          }
        } catch (error) {
          failures.push(`查询缓冲区：${error && error.message ? error.message : Cast.toString(error)}`);
        }

        try {
          if (this._captureBackdropWithCustomFramebuffer(renderer, metrics, drawables)) {
            this._materialBackendName = '兼容自建 FBO';
            this._materialFallbackReason = '';
            this._materialCaptureActive = true;
            this._materialCaptureFailures = 0;
            return true;
          }
        } catch (error) {
          failures.push(`自建 FBO：${error && error.message ? error.message : Cast.toString(error)}`);
        }

        this._materialCaptureFailures++;
        this._materialBackendName = '动态采样失败';
        this._materialFallbackReason = failures.join('；') || '未知后景采样错误';
        return false;
      } finally {
        try {
          if (typeof renderer._doExitDrawRegion === 'function') renderer._doExitDrawRegion();
          gl.bindFramebuffer(gl.FRAMEBUFFER, oldFramebuffer);
          if (oldViewport && oldViewport.length >= 4) {
            gl.viewport(oldViewport[0], oldViewport[1], oldViewport[2], oldViewport[3]);
          } else {
            const canvas = gl.canvas || renderer.canvas;
            gl.viewport(0, 0, canvas && canvas.width ? canvas.width : metrics.width, canvas && canvas.height ? canvas.height : metrics.height);
          }
          if (oldClearColor && oldClearColor.length >= 4) {
            gl.clearColor(oldClearColor[0], oldClearColor[1], oldClearColor[2], oldClearColor[3]);
          } else {
            gl.clearColor(bg[0], bg[1], bg[2], bg[3] === undefined ? 1 : bg[3]);
          }
          if (typeof gl.colorMask === 'function') gl.colorMask(true, true, true, true);
          if (typeof gl.disable === 'function' && gl.STENCIL_TEST !== undefined) gl.disable(gl.STENCIL_TEST);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        } catch (error) {
          // 下一次 Renderer.draw 会重建标准状态。
        }
      }
    }

    _releaseProxyMaterial(record) {
      if (!record) return;
      const renderer = this._renderer || (vm && vm.renderer);
      if (renderer && record.materialSkinId !== null) {
        try {
          if (typeof renderer.destroySkin === 'function') renderer.destroySkin(record.materialSkinId);
        } catch (error) {
          // Skin 可能已随项目重载释放。
        }
      }
      record.materialSkinId = null;
      record.materialCanvas = null;
      record.materialContext = null;
      record.materialWidth = 0;
      record.materialHeight = 0;
    }

    _ensureProxyMaterialSurface(renderer, record, metrics) {
      if (!record || this.backgroundMaterial === 'solid') return false;
      const width = metrics.width;
      const height = metrics.height;
      if (!record.materialCanvas) {
        record.materialCanvas = this._makeCanvas(width, height);
        record.materialContext = record.materialCanvas && record.materialCanvas.getContext('2d');
      }
      if (!record.materialCanvas || !record.materialContext) return false;
      if (record.materialCanvas.width !== width) record.materialCanvas.width = width;
      if (record.materialCanvas.height !== height) record.materialCanvas.height = height;
      record.materialWidth = width;
      record.materialHeight = height;

      if (
        record.materialSkinId !== null && renderer._allSkins &&
        !renderer._allSkins[record.materialSkinId]
      ) {
        record.materialSkinId = null;
      }
      if (record.materialSkinId === null) {
        record.materialSkinId = renderer.createBitmapSkin(
          record.materialCanvas,
          metrics.costumeResolution,
          [metrics.rotationCenterX, metrics.rotationCenterY]
        );
        this._forceLinearSkinSampling(renderer, record.materialSkinId);
      }
      return Number.isFinite(record.materialSkinId);
    }

    _uploadProxyMaterial(renderer, record, metrics) {
      if (!record || record.materialSkinId === null || !record.materialCanvas) return false;
      try {
        renderer.updateBitmapSkin(
          record.materialSkinId,
          record.materialCanvas,
          metrics.costumeResolution,
          [metrics.rotationCenterX, metrics.rotationCenterY]
        );
        this._forceLinearSkinSampling(renderer, record.materialSkinId);
        this._bindSkinToDrawable(renderer, record.proxyDrawableId, record.materialSkinId);
        return true;
      } catch (error) {
        this._materialFallbackReason = error && error.message ? error.message : Cast.toString(error);
        return false;
      }
    }

    _forceLinearSkinSampling(renderer, skinId) {
      if (!this.forceLinearTextureSampling || !renderer || !Number.isFinite(skinId)) return false;
      const skin = renderer._allSkins && renderer._allSkins[skinId];
      if (!skin) return false;
      try {
        if (!Object.prototype.hasOwnProperty.call(skin, '__utOriginalUseNearest')) {
          Object.defineProperty(skin, '__utOriginalUseNearest', {
            value: typeof skin.useNearest === 'function' ? skin.useNearest : null,
            configurable: true,
            enumerable: false,
            writable: false
          });
        }
        // Scratch BitmapSkin 默认返回 true；这里仅覆盖本扩展创建的 Skin。
        skin.useNearest = function () { return false; };
        const gl = renderer._gl || renderer.gl;
        if (gl && skin._texture) {
          gl.bindTexture(gl.TEXTURE_2D, skin._texture);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        }
        return true;
      } catch (error) {
        this._nativeError = error && error.message ? error.message : Cast.toString(error);
        return false;
      }
    }

    getBlurAlgorithmName() {
      const sampling = this.forceLinearTextureSampling ? '线性纹理采样' : '宿主默认采样';
      return `${this._blurAlgorithmName} + ${sampling} + 战斗框 ${this.getTextureScale()}× 超采样`;
    }

    _bindSharedSkinToProxies(renderer) {
      this._forceLinearSkinSampling(renderer, this._skinId);
      for (const record of this._replacementRecords.values()) {
        if (record.materialSkinId !== null) this._releaseProxyMaterial(record);
        if (Number.isFinite(record.proxyDrawableId)) {
          this._bindSkinToDrawable(renderer, record.proxyDrawableId, this._skinId);
        }
      }
    }

    _updateMaterialTextures(renderer, metrics, force, staticChanged) {
      if (!renderer || this._skinId === null) return false;
      const now = getNowMs();

      if (this._isGpuZoomFreezeActive() && !force) {
        this._gpuMemoryGuardStatus = `摄像机缩放中：复用 ${metrics.width}×${metrics.height} 纹理，动态材质已暂停`;
        return true;
      }

      if (this.backgroundMaterial === 'solid') {
        this._materialCaptureActive = false;
        this._materialFallbackReason = '';
        if (force || staticChanged || this._materialLastCaptureMs < 0) {
          this._composeMaterial(this.cacheCanvas, this.cacheContext, metrics, false);
          this._uploadNativeTexture(metrics);
          this._materialLastCaptureMs = now;
          this._materialUpdateCount++;
        }
        this._bindSharedSkinToProxies(renderer);
        return true;
      }

      let missingProxySurface = false;
      for (const record of this._replacementRecords.values()) {
        if (Number.isFinite(record.proxyDrawableId) && record.materialSkinId === null) {
          missingProxySurface = true;
          break;
        }
      }
      const performanceConfig = this._getPerformanceConfig();
      const materialCap = this._animationActive
        ? Math.min(performanceConfig.materialHzCap, performanceConfig.animationMaterialHzCap || performanceConfig.materialHzCap)
        : performanceConfig.materialHzCap;
      const effectiveMaterialHz = Math.max(1, Math.min(this.materialRefreshHz, materialCap));
      const interval = 1000 / effectiveMaterialHz;
      let captureDue = force || missingProxySurface || this._deferredMaterialCapture ||
        !this._hasCapturedBackdrop || !Number.isFinite(this._materialLastCaptureMs) ||
        now - this._materialLastCaptureMs >= interval;

      // A geometry frame already performs mask/border rasterization and BitmapSkin upload.
      // If a valid blurred backdrop exists, reuse it this frame and defer readPixels/blur
      // to the next frame, eliminating the largest Tween/effect frame-time spike.
      if (staticChanged && captureDue && this._hasCapturedBackdrop && !force) {
        captureDue = false;
        this._deferredMaterialCapture = true;
      }

      if (this._replacementRecords.size === 0) {
        if (!captureDue && !staticChanged) return true;
        let backdropReady = this._hasCapturedBackdrop && this._materialCaptureActive;
        if (captureDue) {
          backdropReady = this._captureBackdrop(renderer, metrics, this._drawableId);
          this._hasCapturedBackdrop = backdropReady;
          this._materialLastCaptureMs = now;
          this._deferredMaterialCapture = false;
          this._captureCount++;
        } else {
          this._composeOnlyCount++;
        }
        this._composeMaterial(this.cacheCanvas, this.cacheContext, metrics, backdropReady);
        this._uploadNativeTexture(metrics);
        this._materialUpdateCount++;
        return true;
      }

      // Proxy materials cannot cheaply re-mask an old backdrop because each proxy has
      // a different layer cut-off. During continuous Tween/effects, defer the expensive
      // FBO/readPixels pass until the geometry becomes stable (or a brand-new proxy needs
      // its first surface). The previous valid proxy texture remains visible meanwhile.
      if (staticChanged && captureDue && !missingProxySurface && !force) {
        this._deferredMaterialCapture = true;
        return true;
      }
      if (!captureDue) return true;
      const records = this._proxyMaterialRecords;
      records.length = 0;
      for (const record of this._replacementRecords.values()) {
        if (Number.isFinite(record.proxyDrawableId)) records.push(record);
      }
      if (records.length === 0) return true;
      const budget = Math.max(1, performanceConfig.proxyCapturesPerFrame);
      let processed = 0;
      let index = this._proxyCaptureCursor % records.length;
      while (processed < budget && processed < records.length) {
        const record = records[index];
        if (this._ensureProxyMaterialSurface(renderer, record, metrics)) {
          const backdropReady = this._captureBackdrop(renderer, metrics, record.proxyDrawableId);
          this._composeMaterial(record.materialCanvas, record.materialContext, metrics, backdropReady);
          this._uploadProxyMaterial(renderer, record, metrics);
          this._captureCount++;
        } else {
          this._bindSkinToDrawable(renderer, record.proxyDrawableId, this._skinId);
        }
        processed++;
        index = (index + 1) % records.length;
      }
      this._proxyCaptureCursor = index;
      this._materialLastCaptureMs = now;
      this._materialUpdateCount++;
      this._hasCapturedBackdrop = true;
      this._deferredMaterialCapture = records.length > processed;
      this._requestRedraw();
      return true;
    }

    _chooseDrawableGroup(renderer) {
      const groups = renderer && renderer._layerGroups;
      if (this.layerMode === 'front') {
        if (!groups || Object.prototype.hasOwnProperty.call(groups, 'sprite')) return 'sprite';
      } else {
        if (!groups || Object.prototype.hasOwnProperty.call(groups, 'background')) return 'background';
        if (Object.prototype.hasOwnProperty.call(groups, 'pen')) return 'pen';
        if (Object.prototype.hasOwnProperty.call(groups, 'sprite')) return 'sprite';
      }
      if (groups) {
        const names = Object.keys(groups);
        if (names.length > 0) return names[0];
      }
      return this.layerMode === 'front' ? 'sprite' : 'background';
    }

    _nativeApiAvailable(renderer) {
      return Boolean(
        renderer &&
        typeof renderer.createBitmapSkin === 'function' &&
        typeof renderer.updateBitmapSkin === 'function' &&
        typeof renderer.createDrawable === 'function'
      );
    }

    _setDrawableVisibleById(renderer, drawableId, visible) {
      if (!renderer || !Number.isFinite(drawableId)) return false;
      const nextVisible = Boolean(visible);
      if (typeof renderer.updateDrawableVisible === 'function') {
        renderer.updateDrawableVisible(drawableId, nextVisible);
      }
      const drawable = renderer._allDrawables && renderer._allDrawables[drawableId];
      if (!drawable) return false;
      if (typeof drawable.updateVisible === 'function') drawable.updateVisible(nextVisible);
      else drawable._visible = nextVisible;
      return true;
    }

    _bindSkinToDrawable(renderer, drawableId, skinId = this._skinId) {
      if (!renderer || !Number.isFinite(drawableId) || skinId === null || skinId === undefined) return false;
      if (typeof renderer.updateDrawableSkinId === 'function') {
        renderer.updateDrawableSkinId(drawableId, skinId);
        return true;
      }
      const drawable = renderer._allDrawables && renderer._allDrawables[drawableId];
      const skin = renderer._allSkins && renderer._allSkins[skinId];
      if (!drawable || !skin) return false;
      drawable.skin = skin;
      return true;
    }

    _bindDrawableSkin(renderer) {
      return this._bindSkinToDrawable(renderer, this._drawableId);
    }

    _updateDrawableTransformById(renderer, drawableId, metrics) {
      if (!renderer || !Number.isFinite(drawableId) || !metrics) return;
      const position = [metrics.centerX, metrics.centerY];
      const drawable = renderer._allDrawables && renderer._allDrawables[drawableId];

      if (typeof renderer.updateDrawablePosition === 'function') {
        renderer.updateDrawablePosition(drawableId, position);
      } else if (drawable && typeof drawable.updatePosition === 'function') {
        drawable.updatePosition(position);
      }

      if (typeof renderer.updateDrawableDirectionScale === 'function') {
        renderer.updateDrawableDirectionScale(drawableId, 90, [100, 100]);
      } else if (drawable) {
        if (typeof drawable.updateDirection === 'function') drawable.updateDirection(90);
        if (typeof drawable.updateScale === 'function') drawable.updateScale([100, 100]);
      }
    }

    _getDrawableOrder(renderer, drawableId) {
      if (!renderer || !Number.isFinite(drawableId)) return -1;
      if (typeof renderer.getDrawableOrder === 'function') {
        const order = renderer.getDrawableOrder(drawableId);
        return Number.isFinite(order) ? order : -1;
      }
      if (Array.isArray(renderer._drawList)) return renderer._drawList.indexOf(drawableId);
      return -1;
    }

    _findDrawableGroup(renderer, drawableId) {
      if (!renderer || !Number.isFinite(drawableId)) return null;
      const drawList = renderer._drawList;
      const groups = renderer._layerGroups;
      const ordering = renderer._groupOrdering;
      const order = this._getDrawableOrder(renderer, drawableId);

      if (order >= 0 && Array.isArray(drawList) && groups && Array.isArray(ordering)) {
        for (let i = 0; i < ordering.length; i++) {
          const name = ordering[i];
          const group = groups[name];
          if (!group || !Number.isFinite(group.drawListOffset)) continue;
          const start = group.drawListOffset;
          let end = drawList.length;
          if (i + 1 < ordering.length) {
            const next = groups[ordering[i + 1]];
            if (next && Number.isFinite(next.drawListOffset)) end = next.drawListOffset;
          }
          if (order >= start && order < end) return name;
        }
      }

      if (!groups || Object.prototype.hasOwnProperty.call(groups, 'sprite')) return 'sprite';
      return null;
    }

    _placeProxyBeforeTarget(renderer, proxyDrawableId, targetDrawableId, group) {
      if (!renderer || !Number.isFinite(proxyDrawableId) || !Number.isFinite(targetDrawableId)) return;
      const proxyOrder = this._getDrawableOrder(renderer, proxyDrawableId);
      const targetOrder = this._getDrawableOrder(renderer, targetDrawableId);
      if (proxyOrder < 0 || targetOrder < 0 || proxyOrder === targetOrder - 1) return;

      // setDrawableOrder 会先移除代理，再按绝对索引插入；如果代理原本位于
      // 目标之前，目标索引会在移除后减一，因此需要先校正。
      const desired = targetOrder - (proxyOrder < targetOrder ? 1 : 0);
      if (typeof renderer.setDrawableOrder === 'function' && group) {
        // 官方实现把 order === 0 解释为“不移动”，因此用 -Infinity 表示组首。
        renderer.setDrawableOrder(proxyDrawableId, desired === 0 ? -Infinity : desired, group);
        return;
      }

      // 极旧宿主的保底路径：同组内移动不会改变 layer group offsets。
      if (Array.isArray(renderer._drawList)) {
        const oldIndex = renderer._drawList.indexOf(proxyDrawableId);
        const targetIndex = renderer._drawList.indexOf(targetDrawableId);
        if (oldIndex < 0 || targetIndex < 0) return;
        renderer._drawList.splice(oldIndex, 1);
        const correctedTarget = targetIndex - (oldIndex < targetIndex ? 1 : 0);
        renderer._drawList.splice(Math.max(0, correctedTarget), 0, proxyDrawableId);
      }
    }

    _targetIsAlive(target) {
      if (!target || target.isStage) return false;
      if (!runtime || !Array.isArray(runtime.targets)) return true;
      return runtime.targets.indexOf(target) >= 0;
    }

    _destroyProxyDrawable(record) {
      if (!record) return;
      const renderer = this._renderer || (vm && vm.renderer);
      const drawableId = record.proxyDrawableId;
      if (renderer && Number.isFinite(drawableId)) {
        try {
          if (typeof renderer.destroyDrawable === 'function' && record.proxyGroup) {
            renderer.destroyDrawable(drawableId, record.proxyGroup);
          } else if (renderer._allDrawables) {
            const drawable = renderer._allDrawables[drawableId];
            if (drawable && typeof drawable.dispose === 'function') drawable.dispose();
            delete renderer._allDrawables[drawableId];
            if (Array.isArray(renderer._drawList)) {
              const index = renderer._drawList.indexOf(drawableId);
              if (index >= 0) renderer._drawList.splice(index, 1);
            }
          }
        } catch (error) {
          // 宿主可能在项目重载时先销毁 Drawable。
        }
      }
      record.proxyDrawableId = null;
      record.proxyGroup = null;
    }

    _restoreTargetDrawable(record) {
      if (!record) return;
      const renderer = this._renderer || (vm && vm.renderer);
      const target = record.target;
      const currentId = target && Number.isFinite(target.drawableID)
        ? target.drawableID
        : record.originalDrawableId;
      if (renderer && Number.isFinite(currentId)) {
        this._setDrawableVisibleById(renderer, currentId, !target || target.visible !== false);
      }
    }

    _destroyReplacementRecord(record, restoreOriginal) {
      if (!record) return;
      this._destroyProxyDrawable(record);
      this._releaseProxyMaterial(record);
      if (restoreOriginal) this._restoreTargetDrawable(record);
    }

    _syncTargetReplacements(renderer, metrics) {
      if (!renderer || this._skinId === null || this._replacementRecords.size === 0) return 0;
      let activeCount = 0;
      const entries = Array.from(this._replacementRecords.entries());

      for (let i = 0; i < entries.length; i++) {
        const target = entries[i][0];
        const record = entries[i][1];
        if (!this._targetIsAlive(target)) {
          this._destroyReplacementRecord(record, false);
          this._replacementRecords.delete(target);
          continue;
        }

        const targetDrawableId = Number.isFinite(target.drawableID) ? target.drawableID : null;
        const targetDrawable = targetDrawableId !== null && renderer._allDrawables
          ? renderer._allDrawables[targetDrawableId]
          : null;
        if (targetDrawableId === null || (renderer._allDrawables && !targetDrawable)) {
          this._destroyProxyDrawable(record);
          continue;
        }

        if (record.originalDrawableId !== targetDrawableId) {
          if (
            Number.isFinite(record.originalDrawableId) && renderer._allDrawables &&
            renderer._allDrawables[record.originalDrawableId]
          ) {
            this._setDrawableVisibleById(
              renderer,
              record.originalDrawableId,
              target.visible !== false
            );
          }
          this._destroyProxyDrawable(record);
          record.originalDrawableId = targetDrawableId;
        }

        const targetGroup = this._findDrawableGroup(renderer, targetDrawableId) || 'sprite';
        if (record.proxyDrawableId !== null && record.proxyGroup !== targetGroup) {
          this._destroyProxyDrawable(record);
        }
        if (
          record.proxyDrawableId !== null && renderer._allDrawables &&
          !renderer._allDrawables[record.proxyDrawableId]
        ) {
          record.proxyDrawableId = null;
          record.proxyGroup = null;
        }

        if (record.proxyDrawableId === null) {
          const proxyId = renderer.createDrawable(targetGroup);
          if (!Number.isFinite(proxyId)) continue;
          record.proxyDrawableId = proxyId;
          record.proxyGroup = targetGroup;
          const initialSkinId = this.backgroundMaterial === 'solid' || record.materialSkinId === null
            ? this._skinId
            : record.materialSkinId;
          if (!this._bindSkinToDrawable(renderer, proxyId, initialSkinId)) {
            this._destroyProxyDrawable(record);
            continue;
          }
        } else {
          const currentSkinId = this.backgroundMaterial === 'solid' || record.materialSkinId === null
            ? this._skinId
            : record.materialSkinId;
          this._bindSkinToDrawable(renderer, record.proxyDrawableId, currentSkinId);
        }

        this._updateDrawableTransformById(renderer, record.proxyDrawableId, metrics);
        this._placeProxyBeforeTarget(
          renderer,
          record.proxyDrawableId,
          targetDrawableId,
          record.proxyGroup
        );

        const replacementVisible = this.enabled && target.visible !== false;
        if (this.enabled) {
          // 只隐藏 Renderer Drawable；绝不修改 target.visible。
          this._setDrawableVisibleById(renderer, targetDrawableId, false);
        } else {
          this._setDrawableVisibleById(renderer, targetDrawableId, target.visible !== false);
        }
        this._setDrawableVisibleById(renderer, record.proxyDrawableId, replacementVisible);
        activeCount++;
      }
      return activeCount;
    }

    _syncTargetInteriorClips(renderer) {
      this._clipDrawableIds.clear();
      if (!renderer || this._interiorClipRecords.size === 0) return 0;

      let count = 0;
      const entries = Array.from(this._interiorClipRecords.entries());
      for (let i = 0; i < entries.length; i++) {
        const target = entries[i][0];
        const record = entries[i][1];
        if (!this._targetIsAlive(target)) {
          this._interiorClipRecords.delete(target);
          continue;
        }

        // 防止外部代码在积木执行后重新开启了互斥的角色替换模式。
        if (this._replacementRecords.has(target)) {
          this._interiorClipRecords.delete(target);
          continue;
        }

        const drawableId = Number.isFinite(target.drawableID) ? target.drawableID : null;
        const drawable = drawableId !== null && renderer._allDrawables
          ? renderer._allDrawables[drawableId]
          : null;
        if (drawableId === null || (renderer._allDrawables && !drawable)) {
          record.drawableId = null;
          continue;
        }

        record.drawableId = drawableId;
        this._clipDrawableIds.add(drawableId);
        count++;
      }
      return count;
    }

    _destroyClipMaskResources() {
      const renderer = this._clipHookRenderer || this._renderer || (vm && vm.renderer);
      if (renderer && this._clipMaskDrawableId !== null) {
        try {
          if (typeof renderer.destroyDrawable === 'function' && this._clipMaskGroup) {
            renderer.destroyDrawable(this._clipMaskDrawableId, this._clipMaskGroup);
          } else if (renderer._allDrawables) {
            const drawable = renderer._allDrawables[this._clipMaskDrawableId];
            if (drawable && typeof drawable.dispose === 'function') drawable.dispose();
            delete renderer._allDrawables[this._clipMaskDrawableId];
            if (Array.isArray(renderer._drawList)) {
              const index = renderer._drawList.indexOf(this._clipMaskDrawableId);
              if (index >= 0) renderer._drawList.splice(index, 1);
            }
          }
        } catch (error) {
          // Renderer 可能已在项目重载时提前释放。
        }
      }
      if (renderer && this._clipMaskSkinId !== null) {
        try {
          if (typeof renderer.destroySkin === 'function') renderer.destroySkin(this._clipMaskSkinId);
        } catch (error) {
          // Ignore resources already released by the host.
        }
      }
      this._clipMaskDrawableId = null;
      this._clipMaskSkinId = null;
      this._clipMaskGroup = null;
      this._clipMaskMetricsKey = '';
      this._clipMaskDirty = true;
    }

    _installStencilHook(renderer) {
      if (!renderer || typeof renderer._drawThese !== 'function') {
        this._clipLastError = '宿主未暴露 Renderer._drawThese';
        return false;
      }
      const gl = renderer._gl;
      if (!gl || gl.STENCIL_TEST === undefined || gl.STENCIL_BUFFER_BIT === undefined) {
        this._clipLastError = 'WebGL 上下文没有 stencil buffer';
        return false;
      }

      if (
        this._clipHookRenderer === renderer &&
        this._clipWrappedDrawThese &&
        renderer._drawThese === this._clipWrappedDrawThese
      ) {
        return true;
      }

      this._uninstallStencilHook();

      // 同一个 Renderer 上若残留旧版本补丁，先让旧拥有者恢复原函数。
      const oldPatch = renderer.__utBattleBoxStencilClipPatch;
      if (oldPatch && oldPatch.owner && oldPatch.owner !== this) {
        try {
          if (typeof oldPatch.owner._uninstallStencilHook === 'function') {
            oldPatch.owner._uninstallStencilHook();
          }
        } catch (error) {
          // Continue and replace stale patch.
        }
      }

      const original = renderer._drawThese;
      const owner = this;
      const wrapped = function (drawableIDs, drawMode, projection, opts) {
        return owner._dispatchStencilDraw(
          this,
          original,
          drawableIDs,
          drawMode,
          projection,
          opts
        );
      };

      this._clipHookRenderer = renderer;
      this._clipOriginalDrawThese = original;
      this._clipWrappedDrawThese = wrapped;
      renderer._drawThese = wrapped;
      renderer.__utBattleBoxStencilClipPatch = {owner: this, original, wrapped};
      this._clipBackendName = 'WebGL Stencil 原生裁剪';
      this._clipLastError = '';
      return true;
    }

    _uninstallStencilHook() {
      const renderer = this._clipHookRenderer;
      if (renderer) {
        const patch = renderer.__utBattleBoxStencilClipPatch;
        if (patch && patch.owner === this) {
          if (renderer._drawThese === patch.wrapped) renderer._drawThese = patch.original;
          try { delete renderer.__utBattleBoxStencilClipPatch; } catch (error) {
            renderer.__utBattleBoxStencilClipPatch = null;
          }
        } else if (
          this._clipWrappedDrawThese &&
          renderer._drawThese === this._clipWrappedDrawThese &&
          this._clipOriginalDrawThese
        ) {
          renderer._drawThese = this._clipOriginalDrawThese;
        }
      }
      this._clipHookRenderer = null;
      this._clipOriginalDrawThese = null;
      this._clipWrappedDrawThese = null;
    }

    _ensureClipMaskRenderer(renderer, metrics, staticChanged) {
      if (!renderer || !metrics || !this.maskCanvas) return false;
      if (!this._installStencilHook(renderer)) return false;

      try {
        if (
          this._clipMaskSkinId !== null && renderer._allSkins &&
          !renderer._allSkins[this._clipMaskSkinId]
        ) {
          this._clipMaskSkinId = null;
          this._clipMaskDrawableId = null;
          this._clipMaskGroup = null;
        }
        if (
          this._clipMaskDrawableId !== null && renderer._allDrawables &&
          !renderer._allDrawables[this._clipMaskDrawableId]
        ) {
          this._clipMaskDrawableId = null;
          this._clipMaskGroup = null;
        }

        if (this._clipMaskSkinId === null) {
          this._clipMaskSkinId = renderer.createBitmapSkin(
            this.maskCanvas,
            metrics.costumeResolution,
            [metrics.rotationCenterX, metrics.rotationCenterY]
          );
          this._forceLinearSkinSampling(renderer, this._clipMaskSkinId);
          this._clipMaskDirty = false;
          this._clipMaskMetricsKey = metrics.key;
        } else if (
          staticChanged || this._clipMaskDirty || this._clipMaskMetricsKey !== metrics.key
        ) {
          renderer.updateBitmapSkin(
            this._clipMaskSkinId,
            this.maskCanvas,
            metrics.costumeResolution,
            [metrics.rotationCenterX, metrics.rotationCenterY]
          );
          this._forceLinearSkinSampling(renderer, this._clipMaskSkinId);
          this._clipMaskDirty = false;
          this._clipMaskMetricsKey = metrics.key;
        }

        if (this._clipMaskDrawableId === null) {
          this._clipMaskGroup = this._layerGroupsHas(renderer, 'sprite') ? 'sprite' : this._chooseDrawableGroup(renderer);
          this._clipMaskDrawableId = renderer.createDrawable(this._clipMaskGroup);
          if (!Number.isFinite(this._clipMaskDrawableId)) {
            this._clipMaskDrawableId = null;
            throw new Error('无法创建 stencil 内部遮罩 Drawable');
          }
          if (!this._bindSkinToDrawable(renderer, this._clipMaskDrawableId, this._clipMaskSkinId)) {
            throw new Error('无法绑定 stencil 内部遮罩 Skin');
          }
        }

        this._bindSkinToDrawable(renderer, this._clipMaskDrawableId, this._clipMaskSkinId);
        this._updateDrawableTransformById(renderer, this._clipMaskDrawableId, metrics);
        // 正常 Renderer 绘制时不可见；stencil hook 会用 ignoreVisibility 主动绘制。
        this._setDrawableVisibleById(renderer, this._clipMaskDrawableId, false);
        this._clipBackendName = 'WebGL Stencil 原生裁剪';
        this._clipLastError = '';
        return true;
      } catch (error) {
        this._clipLastError = error && error.message ? error.message : Cast.toString(error);
        return false;
      }
    }

    _layerGroupsHas(renderer, group) {
      return Boolean(renderer && renderer._layerGroups && renderer._layerGroups[group]);
    }

    _shouldInterceptStencilDraw(renderer, drawableIDs, drawMode, opts) {
      if (
        this._clipBypassDepth > 0 || !this.enabled ||
        this._clipDrawableIds.size === 0 ||
        this._clipMaskDrawableId === null ||
        !this.manager || !this.manager.areaRecords || this.manager.areaRecords.size === 0 ||
        !Array.isArray(drawableIDs) || drawMode !== 'default' ||
        (opts && opts.ignoreVisibility)
      ) return false;

      const gl = renderer && renderer._gl;
      if (!gl) return false;

      // 只修改最终舞台默认 Framebuffer。后景材质 FBO、颜色检测、拾取和
      // touching-color 查询必须保持 Renderer 原本的私有绘制语义。
      if (typeof gl.getParameter === 'function' && gl.FRAMEBUFFER_BINDING !== undefined) {
        try {
          if (gl.getParameter(gl.FRAMEBUFFER_BINDING) !== null) return false;
        } catch (error) {
          // If querying binding is unsupported, fall through to conservative checks.
        }
      } else if (this._materialCaptureActive) {
        return false;
      }

      for (let i = 0; i < drawableIDs.length; i++) {
        if (this._clipDrawableIds.has(drawableIDs[i])) return true;
      }
      return false;
    }

    _dispatchStencilDraw(renderer, original, drawableIDs, drawMode, projection, opts) {
      if (!this._shouldInterceptStencilDraw(renderer, drawableIDs, drawMode, opts)) {
        return original.call(renderer, drawableIDs, drawMode, projection, opts);
      }

      const gl = renderer._gl;
      const normalChunk = [];
      let stencilPrepared = false;

      const callOriginal = (ids, mode = drawMode, options = opts) => {
        if (!ids || ids.length === 0) return;
        this._clipBypassDepth++;
        try {
          return original.call(renderer, ids, mode, projection, options);
        } finally {
          this._clipBypassDepth--;
        }
      };

      const flushNormal = () => {
        if (normalChunk.length === 0) return;
        if (typeof renderer._doExitDrawRegion === 'function') renderer._doExitDrawRegion();
        gl.disable(gl.STENCIL_TEST);
        callOriginal(normalChunk.slice());
        normalChunk.length = 0;
      };

      let previous = null;
      try {
        previous = {
          stencilEnabled: typeof gl.isEnabled === 'function' ? gl.isEnabled(gl.STENCIL_TEST) : false,
          colorMask: typeof gl.getParameter === 'function' && gl.COLOR_WRITEMASK !== undefined
            ? gl.getParameter(gl.COLOR_WRITEMASK) : [true, true, true, true],
          stencilWriteMask: typeof gl.getParameter === 'function' && gl.STENCIL_WRITEMASK !== undefined
            ? gl.getParameter(gl.STENCIL_WRITEMASK) : 0xff,
          stencilFunc: typeof gl.getParameter === 'function' && gl.STENCIL_FUNC !== undefined
            ? gl.getParameter(gl.STENCIL_FUNC) : gl.ALWAYS,
          stencilRef: typeof gl.getParameter === 'function' && gl.STENCIL_REF !== undefined
            ? gl.getParameter(gl.STENCIL_REF) : 0,
          stencilValueMask: typeof gl.getParameter === 'function' && gl.STENCIL_VALUE_MASK !== undefined
            ? gl.getParameter(gl.STENCIL_VALUE_MASK) : 0xff,
          stencilFail: typeof gl.getParameter === 'function' && gl.STENCIL_FAIL !== undefined
            ? gl.getParameter(gl.STENCIL_FAIL) : gl.KEEP,
          stencilPassDepthFail: typeof gl.getParameter === 'function' && gl.STENCIL_PASS_DEPTH_FAIL !== undefined
            ? gl.getParameter(gl.STENCIL_PASS_DEPTH_FAIL) : gl.KEEP,
          stencilPassDepthPass: typeof gl.getParameter === 'function' && gl.STENCIL_PASS_DEPTH_PASS !== undefined
            ? gl.getParameter(gl.STENCIL_PASS_DEPTH_PASS) : gl.KEEP
        };

        for (let i = 0; i < drawableIDs.length; i++) {
          const drawableId = drawableIDs[i];
          if (!this._clipDrawableIds.has(drawableId)) {
            normalChunk.push(drawableId);
            continue;
          }

          flushNormal();

          if (!stencilPrepared) {
            if (typeof renderer._doExitDrawRegion === 'function') renderer._doExitDrawRegion();
            gl.enable(gl.STENCIL_TEST);
            gl.stencilMask(0xff);
            if (typeof gl.clearStencil === 'function') gl.clearStencil(0);
            gl.clear(gl.STENCIL_BUFFER_BIT);
            gl.colorMask(false, false, false, false);
            gl.stencilFunc(gl.ALWAYS, 1, 0xff);
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

            const maskOpts = Object.assign({}, opts || {}, {
              ignoreVisibility: true,
              // 不让 ghost 等角色效果改变遮罩 Alpha。
              effectMask: 0
            });
            callOriginal([this._clipMaskDrawableId], 'silhouette', maskOpts);
            if (typeof renderer._doExitDrawRegion === 'function') renderer._doExitDrawRegion();
            gl.colorMask(true, true, true, true);
            gl.stencilMask(0x00);
            stencilPrepared = true;
          }

          if (typeof renderer._doExitDrawRegion === 'function') renderer._doExitDrawRegion();
          gl.enable(gl.STENCIL_TEST);
          gl.stencilFunc(gl.EQUAL, 1, 0xff);
          gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
          callOriginal([drawableId]);
        }

        flushNormal();
      } catch (error) {
        this._clipLastError = error && error.message ? error.message : Cast.toString(error);
        // 若 stencil 路径异常，至少保证本帧仍能绘制；目标可能暂时未裁剪，
        // 但不会让整个舞台黑屏。
        if (normalChunk.length > 0) {
          try { callOriginal(normalChunk.slice()); } catch (ignored) { /* no-op */ }
          normalChunk.length = 0;
        }
      } finally {
        try {
          if (typeof renderer._doExitDrawRegion === 'function') renderer._doExitDrawRegion();
          gl.colorMask(
            previous.colorMask[0], previous.colorMask[1],
            previous.colorMask[2], previous.colorMask[3]
          );
          gl.stencilMask(previous.stencilWriteMask);
          gl.stencilFunc(previous.stencilFunc, previous.stencilRef, previous.stencilValueMask);
          gl.stencilOp(
            previous.stencilFail,
            previous.stencilPassDepthFail,
            previous.stencilPassDepthPass
          );
          if (previous.stencilEnabled) gl.enable(gl.STENCIL_TEST);
          else gl.disable(gl.STENCIL_TEST);
        } catch (ignored) {
          try {
            gl.colorMask(true, true, true, true);
            gl.stencilMask(0xff);
            gl.disable(gl.STENCIL_TEST);
          } catch (ignoredAgain) { /* no-op */ }
        }
      }
    }

    _updateNativeTransform(renderer, metrics) {
      this._updateDrawableTransformById(renderer, this._drawableId, metrics);
    }

    _setNativeVisible(visible) {
      const renderer = this._renderer || (vm && vm.renderer);
      this._setDrawableVisibleById(renderer, this._drawableId, visible);
    }

    _enforceNativeOrder(renderer) {
      if (!renderer || this._drawableId === null || !this._drawableGroup) return;
      if (typeof renderer.setDrawableOrder === 'function') {
        const order = this.layerMode === 'front' ? Infinity : Infinity;
        // background 组中 Infinity = 背景之后；sprite 组中 front = 所有精灵之前。
        // 如果 behind 只能退化到 sprite 组，则 0 = 所有普通精灵之后方。
        const actualOrder = this.layerMode === 'behind' && this._drawableGroup === 'sprite' ? 0 : order;
        renderer.setDrawableOrder(this._drawableId, actualOrder, this._drawableGroup);
      }
    }

    _disposeDrawableOnly() {
      const renderer = this._renderer;
      if (renderer && this._drawableId !== null) {
        try {
          if (typeof renderer.destroyDrawable === 'function' && this._drawableGroup) {
            renderer.destroyDrawable(this._drawableId, this._drawableGroup);
          } else if (renderer._allDrawables) {
            const drawable = renderer._allDrawables[this._drawableId];
            if (drawable && typeof drawable.dispose === 'function') drawable.dispose();
            delete renderer._allDrawables[this._drawableId];
          }
        } catch (error) {
          // Renderer may already have disposed resources during project reload.
        }
      }
      this._drawableId = null;
      this._drawableGroup = null;
      this._nativeReady = false;
      this._nativeMetricsKey = '';
    }

    dispose() {
      this.restoreAllTargetInteriorClips();
      this._uninstallStencilHook();
      this._destroyClipMaskResources();
      const replacementRecords = Array.from(this._replacementRecords.values());
      for (let i = 0; i < replacementRecords.length; i++) {
        this._destroyReplacementRecord(replacementRecords[i], true);
      }
      this._replacementRecords.clear();
      this._disposeDrawableOnly();
      const renderer = this._renderer;
      if (renderer && this._skinId !== null) {
        try {
          if (typeof renderer.destroySkin === 'function') renderer.destroySkin(this._skinId);
        } catch (error) {
          // Ignore resources already released by the host.
        }
      }
      this._skinId = null;
      this._disposeBackdropResources();
      if (this._contextLossCanvas && typeof this._contextLossCanvas.removeEventListener === 'function') {
        try {
          if (this._contextLostHandler) this._contextLossCanvas.removeEventListener('webglcontextlost', this._contextLostHandler);
          if (this._contextRestoredHandler) this._contextLossCanvas.removeEventListener('webglcontextrestored', this._contextRestoredHandler);
        } catch (error) { /* ignored */ }
      }
      this._contextLossCanvas = null;
      this._contextLostHandler = null;
      this._contextRestoredHandler = null;
      this._renderer = null;
      this._nativeReady = false;
      this._detachDebugOverlay();
    }

    _ensureNativeRenderer(metrics) {
      const renderer = vm && vm.renderer;
      if (!this._nativeApiAvailable(renderer)) {
        this._nativeReady = false;
        this._nativeError = '宿主未暴露 BitmapSkin/Drawable API';
        return false;
      }

      if (this._renderer && this._renderer !== renderer) this.dispose();
      this._renderer = renderer;
      this._installContextLossHandlers(renderer);
      const gl = renderer && renderer._gl;
      if (gl && typeof gl.isContextLost === 'function' && gl.isContextLost()) {
        this._nativeReady = false;
        this._nativeError = 'WebGL 上下文已丢失，等待恢复';
        return false;
      }

      // 项目重载或宿主重建 Renderer 资源时，旧数字 ID 可能仍保留在扩展实例中。
      // 在复用前验证内部表，避免绑定到已经释放的 Skin/Drawable。
      if (
        this._skinId !== null && renderer._allSkins &&
        !renderer._allSkins[this._skinId]
      ) {
        this._skinId = null;
        this._disposeDrawableOnly();
      }
      if (
        this._drawableId !== null && renderer._allDrawables &&
        !renderer._allDrawables[this._drawableId]
      ) {
        this._drawableId = null;
        this._drawableGroup = null;
        this._nativeReady = false;
      }

      const desiredGroup = this._chooseDrawableGroup(renderer);
      if (this._drawableId !== null && this._drawableGroup !== desiredGroup) {
        this._disposeDrawableOnly();
      }

      try {
        if (this._skinId === null) {
          this._skinId = renderer.createBitmapSkin(
            this.cacheCanvas,
            metrics.costumeResolution,
            [metrics.rotationCenterX, metrics.rotationCenterY]
          );
          this._forceLinearSkinSampling(renderer, this._skinId);
          this._nativeWidth = metrics.width;
          this._nativeHeight = metrics.height;
          this._nativeMetricsKey = metrics.key;
        }

        if (this._drawableId === null) {
          this._drawableGroup = desiredGroup;
          this._drawableId = renderer.createDrawable(this._drawableGroup);
          if (!Number.isFinite(this._drawableId)) {
            this._drawableId = null;
            throw new Error(`无法在 ${this._drawableGroup} 层创建 Drawable`);
          }
          if (!this._bindDrawableSkin(renderer)) {
            throw new Error('无法将 BitmapSkin 绑定到 Drawable');
          }
          this._updateNativeTransform(renderer, metrics);
        }

        // 全屏切换可能重建投影矩阵，但不能改变逻辑 Drawable 坐标。
        // 每帧重新提交逻辑中心，成本极低并能抵御宿主重置。
        this._updateNativeTransform(renderer, metrics);
        this._setNativeVisible(this.enabled && this._replacementRecords.size === 0);
        this._enforceNativeOrder(renderer);
        this._nativeReady = true;
        this._nativeError = '';
        return true;
      } catch (error) {
        this._nativeReady = false;
        this._nativeError = error && error.message ? error.message : Cast.toString(error);
        // 保留可复用 Skin，但销毁未完整绑定的 Drawable，使下一帧能够干净重试。
        this._disposeDrawableOnly();
        return false;
      }
    }

    _uploadNativeTexture(metrics) {
      const renderer = this._renderer;
      if (!renderer || this._skinId === null) return false;
      try {
        renderer.updateBitmapSkin(
          this._skinId,
          this.cacheCanvas,
          metrics.costumeResolution,
          [metrics.rotationCenterX, metrics.rotationCenterY]
        );
        this._forceLinearSkinSampling(renderer, this._skinId);
        this._nativeWidth = metrics.width;
        this._nativeHeight = metrics.height;
        this._nativeMetricsKey = metrics.key;
        this._updateNativeTransform(renderer, metrics);
        this._requestRedraw();
        return true;
      } catch (error) {
        this._nativeError = error && error.message ? error.message : Cast.toString(error);
        this._nativeReady = false;
        return false;
      }
    }

    _requestRedraw() {
      if (runtime && typeof runtime.requestRedraw === 'function') {
        runtime.requestRedraw();
        return;
      }
      const renderer = vm && vm.renderer;
      if (renderer && typeof renderer.draw === 'function') {
        try { renderer.draw(); } catch (error) { /* host controls redraw cadence */ }
      }
    }

    _attachDebugOverlay(baseCanvas) {
      const parent = baseCanvas && baseCanvas.parentElement;
      if (!parent || !this.debugCanvas) return false;
      let computedPosition = '';
      try {
        computedPosition = globalEnv.getComputedStyle ? globalEnv.getComputedStyle(parent).position : '';
      } catch (error) {
        computedPosition = '';
      }
      this._debugParent = parent;
      this._debugParentOldPosition = parent.style.position || '';
      if (!computedPosition || computedPosition === 'static') parent.style.position = 'relative';
      this.debugCanvas.style.position = 'absolute';
      this.debugCanvas.style.pointerEvents = 'none';
      this.debugCanvas.style.zIndex = '60';
      this.debugCanvas.style.margin = '0';
      this.debugCanvas.style.padding = '0';
      this.debugCanvas.style.transformOrigin = '0 0';
      this.debugCanvas.style.transform = 'none';
      this.debugCanvas.style.boxSizing = 'border-box';
      parent.appendChild(this.debugCanvas);
      this._alignDebugOverlay();
      return true;
    }

    _alignDebugOverlay() {
      if (!this.debugCanvas || !this._debugBaseCanvas || !this._debugParent) return;
      if (
        typeof this._debugBaseCanvas.getBoundingClientRect !== 'function' ||
        typeof this._debugParent.getBoundingClientRect !== 'function'
      ) return;
      const baseRect = this._debugBaseCanvas.getBoundingClientRect();
      const parentRect = this._debugParent.getBoundingClientRect();
      const left = baseRect.left - parentRect.left + (this._debugParent.scrollLeft || 0);
      const top = baseRect.top - parentRect.top + (this._debugParent.scrollTop || 0);
      this.debugCanvas.style.left = `${left}px`;
      this.debugCanvas.style.top = `${top}px`;
      this.debugCanvas.style.width = `${Math.max(0, baseRect.width)}px`;
      this.debugCanvas.style.height = `${Math.max(0, baseRect.height)}px`;
    }

    _detachDebugOverlay() {
      if (this.debugCanvas && this.debugCanvas.parentNode) {
        try { this.debugCanvas.parentNode.removeChild(this.debugCanvas); } catch (error) { /* no-op */ }
      }
      if (this._debugParent && this._debugParent.style) {
        this._debugParent.style.position = this._debugParentOldPosition;
      }
      this._debugBaseCanvas = null;
      this._debugParent = null;
    }

    _hideDebugOverlay() {
      if (this.debugCanvas) {
        this.debugCanvas.style.display = 'none';
        if (this.debugContext) this.debugContext.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
      }
    }

    _ensureDebugOverlay(width, height) {
      const renderer = vm && vm.renderer;
      const baseCanvas = renderer && renderer.canvas;
      if (!baseCanvas || !globalEnv.document) return false;
      if (!this.debugCanvas) {
        this.debugCanvas = this._makeCanvas(width, height);
        if (!this.debugCanvas) return false;
        this.debugCanvas.className = 'utbattlebox-v21-debug-overlay';
        this.debugCanvas.style.pointerEvents = 'none';
        this.debugContext = this.debugCanvas.getContext('2d');
      }
      if (this.debugCanvas.width !== width) this.debugCanvas.width = width;
      if (this.debugCanvas.height !== height) this.debugCanvas.height = height;
      if (!this.debugContext) this.debugContext = this.debugCanvas.getContext('2d');
      if (this._debugBaseCanvas !== baseCanvas || !this.debugCanvas.parentNode) {
        this._detachDebugOverlay();
        this._debugBaseCanvas = baseCanvas;
        if (!this._attachDebugOverlay(baseCanvas)) return false;
      }
      this.debugCanvas.style.display = 'block';
      this._alignDebugOverlay();
      return Boolean(this.debugContext);
    }

    _renderDebugOverlay(soul, metrics) {
      if (!this.enabled || (!this.debugHitboxes && !this.debugSoulCollider)) {
        this._hideDebugOverlay();
        return;
      }
      const width = metrics.width;
      const height = metrics.height;
      if (!this._ensureDebugOverlay(width, height)) return;
      const ctx = this.debugContext;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, width, height);

      if (this.debugHitboxes) {
        for (const record of this.manager.hitboxRecords.values()) {
          if (!record.enabled || !record.hitbox) continue;
          const response = record.hitbox.response;
          let fill = 'rgba(255, 64, 64, 0.20)';
          let stroke = 'rgba(255, 64, 64, 0.95)';
          if (response === CollisionResponse.SOLID) {
            fill = 'rgba(255, 170, 0, 0.20)';
            stroke = 'rgba(255, 170, 0, 0.95)';
          } else if (response === CollisionResponse.SOLID_AND_TRIGGER) {
            fill = 'rgba(255, 0, 220, 0.20)';
            stroke = 'rgba(255, 0, 220, 0.95)';
          }
          this._strokeRecord(ctx, record, metrics, fill, stroke);
        }
      }

      if (this.debugSoulCollider && soul) {
        ctx.beginPath();
        const textureScale = Number.isFinite(metrics.textureScale) ? metrics.textureScale : 1;
        ctx.arc(
          (soul.x - metrics.xLeft) * textureScale,
          (metrics.yTop - soul.y) * textureScale,
          Math.max(0.001, soul.radius) * textureScale,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.95)';
        ctx.lineWidth = 1.5 * textureScale;
        ctx.stroke();
      }
    }

    render(soul, force = false, nowMs = getNowMs()) {
      const now = Number.isFinite(nowMs) ? nowMs : getNowMs();
      const metrics = this._getStageMetrics(force, now);
      const currentEffectRevision = this.effectSystem ? this.effectSystem.getRevision() : 0;
      if (!this._isGpuZoomFreezeActive()) this._committedEffectRevision = currentEffectRevision;
      const staticKey = [
        this.manager.collisionVersion,
        metrics.key,
        this.borderColor,
        this.borderWidth,
        this._isGpuZoomFreezeActive() ? this._committedEffectRevision : currentEffectRevision,
        this._getPerformanceConfig().key
      ].join('|');

      const staticNeedsBuild = Boolean(force || this._dirty || staticKey !== this._lastBuildKey);
      const config = this._getPerformanceConfig();
      const maintenanceDue = Boolean(
        force || staticNeedsBuild || !this._nativeReady ||
        now - this._lastMaintenanceMs >= config.maintenanceMs
      );
      const transformDue = metrics.key !== this._lastNativeTransformKey;
      const materialDue = this._isMaterialUpdateDue(now, force, staticNeedsBuild);
      const debugDue = Boolean(
        (this.debugHitboxes || this.debugSoulCollider) &&
        (force || now - this._lastDebugRenderMs >= 1000 / config.renderFps)
      );

      if (!staticNeedsBuild && !maintenanceDue && !transformDue && !materialDue && !debugDue) {
        this._renderSkips++;
        return false;
      }

      if (!this._ensureBuffers(metrics.width, metrics.height, metrics.captureWidth, metrics.captureHeight)) return false;

      let staticChanged = false;
      if (staticNeedsBuild) {
        if (!this._buildStaticLayers(metrics)) return false;
        this._lastBuildKey = staticKey;
        staticChanged = true;
      }

      if (!this._ensureNativeRenderer(metrics)) {
        if (debugDue) {
          this._renderDebugOverlay(soul, metrics);
          this._lastDebugRenderMs = now;
        }
        return false;
      }

      if (transformDue || staticChanged || force) {
        this._updateNativeTransform(this._renderer, metrics);
        this._lastNativeTransformKey = metrics.key;
      }

      let replacementCount = this._cachedReplacementCount;
      let interiorClipCount = this._cachedInteriorClipCount;
      if (maintenanceDue) {
        replacementCount = this._syncTargetReplacements(this._renderer, metrics);
        interiorClipCount = this._syncTargetInteriorClips(this._renderer);
        this._cachedReplacementCount = replacementCount;
        this._cachedInteriorClipCount = interiorClipCount;
        this._lastMaintenanceMs = now;
        this._maintenanceCount++;
      }
      if (interiorClipCount > 0 && (staticChanged || this._clipMaskDirty || force)) {
        this._ensureClipMaskRenderer(this._renderer, metrics, staticChanged);
      }
      this._setNativeVisible(this.enabled && metrics.contentVisible !== false && replacementCount === 0);
      if (maintenanceDue || staticChanged || force) this._enforceNativeOrder(this._renderer);

      if (materialDue) this._updateMaterialTextures(this._renderer, metrics, force, staticChanged);
      if (debugDue) {
        this._renderDebugOverlay(soul, metrics);
        this._lastDebugRenderMs = now;
      } else if (!this.debugHitboxes && !this.debugSoulCollider) {
        this._hideDebugOverlay();
      }
      this._renderCalls++;
      return true;
    }

  }


  class MobileJoystickController {
    constructor(onButtonEvent = null, onInput = null) {
      this.enabled = false;
      this.available = Boolean(globalEnv.document && globalEnv.document.createElement);
      this.onButtonEvent = typeof onButtonEvent === 'function' ? onButtonEvent : null;
      this.onInput = typeof onInput === 'function' ? onInput : null;

      this.relativeX = 18;
      this.relativeY = 78;
      this.outerSize = 118;
      this.knobRatio = 0.42;
      this.deadZone = 0.12;
      this.responseCurve = 'linear';
      this.outerColor = 'rgba(20, 20, 20, 0.42)';
      this.innerColor = 'rgba(255, 255, 255, 0.82)';
      this.outerImage = '';
      this.innerImage = '';

      this.rawX = 0;
      this.rawY = 0;
      this.outputX = 0;
      this.outputY = 0;
      this.active = false;
      this._stickPointerId = null;

      this.container = null;
      this.outer = null;
      this.knob = null;
      this.buttons = new Map();

      this._resizeBound = this._updateLayout.bind(this);
      this._orientationBound = () => globalEnv.setTimeout(this._updateLayout.bind(this), 120);
      this._visibilityBound = () => {
        if (globalEnv.document && globalEnv.document.hidden) this.reset();
      };

      if (this.available) {
        this._createUI();
        this.createDefaultButtons();
      }
    }

    _normalizeButtonKey(id) {
      return Cast.toString(id || '').trim().toLowerCase();
    }

    _displayButtonId(id) {
      return Cast.toString(id || '').trim().slice(0, 32) || 'button';
    }

    _createUI() {
      const document = globalEnv.document;
      if (!document || this.container) return;

      const container = document.createElement('div');
      container.id = 'utbattlebox-mobile-controls';
      Object.assign(container.style, {
        position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh',
        pointerEvents: 'none', zIndex: '2147483000', overflow: 'hidden',
        display: 'none', userSelect: 'none', webkitUserSelect: 'none'
      });

      const outer = document.createElement('div');
      outer.id = 'utbattlebox-mobile-stick';
      Object.assign(outer.style, {
        position: 'absolute', borderRadius: '50%', transform: 'translate(-50%, -50%)',
        boxSizing: 'border-box', pointerEvents: 'auto', touchAction: 'none',
        overflow: 'hidden', backdropFilter: 'blur(2px)', webkitBackdropFilter: 'blur(2px)'
      });

      const knob = document.createElement('div');
      knob.id = 'utbattlebox-mobile-stick-knob';
      Object.assign(knob.style, {
        position: 'absolute', left: '50%', top: '50%', borderRadius: '50%',
        transform: 'translate(-50%, -50%)', pointerEvents: 'none',
        boxSizing: 'border-box', willChange: 'transform'
      });
      outer.appendChild(knob);
      container.appendChild(outer);
      (document.body || document.documentElement).appendChild(container);

      this.container = container;
      this.outer = outer;
      this.knob = knob;

      outer.addEventListener('pointerdown', event => this._stickDown(event), {passive: false});
      outer.addEventListener('pointermove', event => this._stickMove(event), {passive: false});
      outer.addEventListener('pointerup', event => this._stickUp(event), {passive: false});
      outer.addEventListener('pointercancel', event => this._stickUp(event), {passive: false});
      outer.addEventListener('lostpointercapture', event => this._stickUp(event), {passive: false});

      if (globalEnv.addEventListener) {
        globalEnv.addEventListener('resize', this._resizeBound, false);
        globalEnv.addEventListener('orientationchange', this._orientationBound, false);
      }
      if (document.addEventListener) {
        document.addEventListener('visibilitychange', this._visibilityBound, false);
      }

      this._applyAppearance();
      this._updateLayout();
    }

    _safeViewport() {
      const document = globalEnv.document;
      const root = document && document.documentElement;
      const width = Math.max(1, Number(globalEnv.innerWidth) || (root && root.clientWidth) || 480);
      const height = Math.max(1, Number(globalEnv.innerHeight) || (root && root.clientHeight) || 360);
      return {width, height};
    }

    _cssImage(value) {
      const source = Cast.toString(value || '').trim();
      if (!source) return 'none';
      return `url("${source.replace(/"/g, '%22')}")`;
    }

    _updateLayout() {
      if (!this.available || !this.outer) return;
      const viewport = this._safeViewport();
      const half = this.outerSize * 0.5;
      const x = clamp(viewport.width * this.relativeX / 100, half + 4, viewport.width - half - 4);
      const y = clamp(viewport.height * this.relativeY / 100, half + 4, viewport.height - half - 4);
      this.outer.style.left = `${x}px`;
      this.outer.style.top = `${y}px`;

      for (const record of this.buttons.values()) {
        const buttonHalf = record.size * 0.5;
        const bx = clamp(viewport.width * record.relativeX / 100, buttonHalf + 4, viewport.width - buttonHalf - 4);
        const by = clamp(viewport.height * record.relativeY / 100, buttonHalf + 4, viewport.height - buttonHalf - 4);
        record.element.style.left = `${bx}px`;
        record.element.style.top = `${by}px`;
      }
    }

    _applyAppearance() {
      if (!this.outer || !this.knob) return;
      const knobSize = this.outerSize * this.knobRatio;
      this.outer.style.width = `${this.outerSize}px`;
      this.outer.style.height = `${this.outerSize}px`;
      this.outer.style.backgroundColor = this.outerColor;
      this.outer.style.backgroundImage = this._cssImage(this.outerImage);
      this.outer.style.backgroundSize = '100% 100%';
      this.outer.style.backgroundPosition = 'center';
      this.outer.style.backgroundRepeat = 'no-repeat';

      this.knob.style.width = `${knobSize}px`;
      this.knob.style.height = `${knobSize}px`;
      this.knob.style.backgroundColor = this.innerColor;
      this.knob.style.backgroundImage = this._cssImage(this.innerImage);
      this.knob.style.backgroundSize = '100% 100%';
      this.knob.style.backgroundPosition = 'center';
      this.knob.style.backgroundRepeat = 'no-repeat';
      this._updateLayout();
    }

    _applyButtonAppearance(record) {
      if (!record || !record.element) return;
      const el = record.element;
      el.style.width = `${record.size}px`;
      el.style.height = `${record.size}px`;
      el.style.backgroundColor = record.color;
      el.style.backgroundImage = this._cssImage(record.image);
      el.style.backgroundSize = '100% 100%';
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.fontSize = `${Math.max(12, record.size * 0.3)}px`;
      el.textContent = record.text;
      el.style.display = this.enabled && record.visible ? 'flex' : 'none';
      this._updateLayout();
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled) && this.available;
      if (!this.enabled) this.reset();
      if (this.container) this.container.style.display = this.enabled ? 'block' : 'none';
      for (const record of this.buttons.values()) this._applyButtonAppearance(record);
      this._notifyInput();
      return this.enabled;
    }

    configurePosition(relativeX, relativeY, outerSize, knobPercent) {
      this.relativeX = clamp(finiteNumber(relativeX, 18), 0, 100);
      this.relativeY = clamp(finiteNumber(relativeY, 78), 0, 100);
      this.outerSize = clamp(Math.abs(finiteNumber(outerSize, 118)), 48, 320);
      this.knobRatio = clamp(Math.abs(finiteNumber(knobPercent, 42)) / 100, 0.15, 0.9);
      this._applyAppearance();
    }

    configureFeel(deadZonePercent, responseCurve) {
      this.deadZone = clamp(Math.abs(finiteNumber(deadZonePercent, 12)) / 100, 0, 0.9);
      const curve = Cast.toString(responseCurve).toLowerCase();
      this.responseCurve = curve === 'quadratic' || curve === 'cubic' ? curve : 'linear';
      this._recalculateOutput();
    }

    configureColors(outerColor, innerColor) {
      this.outerColor = Cast.toString(outerColor || 'rgba(20, 20, 20, 0.42)');
      this.innerColor = Cast.toString(innerColor || 'rgba(255, 255, 255, 0.82)');
      this._applyAppearance();
    }

    configureImages(outerImage, innerImage) {
      this.outerImage = Cast.toString(outerImage || '').trim();
      this.innerImage = Cast.toString(innerImage || '').trim();
      this._applyAppearance();
    }

    createOrUpdateButton(id, relativeX, relativeY, size, color, text, image = '') {
      if (!this.container) return false;
      const key = this._normalizeButtonKey(id);
      if (!key) return false;
      let record = this.buttons.get(key);
      if (!record) {
        const element = globalEnv.document.createElement('div');
        element.id = `utbattlebox-mobile-button-${key.replace(/[^a-z0-9_-]/g, '_')}`;
        Object.assign(element.style, {
          position: 'absolute', borderRadius: '50%', transform: 'translate(-50%, -50%)',
          display: 'none', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'sans-serif', fontWeight: '700', color: '#222',
          pointerEvents: 'auto', touchAction: 'none', boxSizing: 'border-box',
          userSelect: 'none', webkitUserSelect: 'none', overflow: 'hidden'
        });
        this.container.appendChild(element);
        record = {
          key, id: this._displayButtonId(id), element, relativeX: 84, relativeY: 78,
          size: 72, color: 'rgba(255,255,255,0.64)', text: this._displayButtonId(id),
          image: '', visible: true, pointers: new Set(), held: false,
          pressedAt: -Infinity, releasedAt: -Infinity
        };
        this.buttons.set(key, record);
        element.addEventListener('pointerdown', event => this._buttonDown(record, event), {passive: false});
        element.addEventListener('pointerup', event => this._buttonUp(record, event), {passive: false});
        element.addEventListener('pointercancel', event => this._buttonUp(record, event), {passive: false});
        element.addEventListener('lostpointercapture', event => this._buttonUp(record, event), {passive: false});
      }
      record.id = this._displayButtonId(id);
      record.relativeX = clamp(finiteNumber(relativeX, record.relativeX), 0, 100);
      record.relativeY = clamp(finiteNumber(relativeY, record.relativeY), 0, 100);
      record.size = clamp(Math.abs(finiteNumber(size, record.size)), 28, 260);
      record.color = Cast.toString(color || record.color || 'rgba(255,255,255,0.64)');
      record.text = Cast.toString(text === undefined ? record.id : text).slice(0, 12);
      if (image !== undefined) record.image = Cast.toString(image || '').trim();
      record.visible = true;
      this._applyButtonAppearance(record);
      return true;
    }

    createDefaultButtons() {
      this.createOrUpdateButton('Z', 84, 79, 72, 'rgba(255,235,120,0.76)', 'Z');
      this.createOrUpdateButton('X', 92, 68, 58, 'rgba(255,255,255,0.66)', 'X');
      this.createOrUpdateButton('C', 76, 67, 58, 'rgba(190,225,255,0.66)', 'C');
      return true;
    }

    setButtonImage(id, image) {
      const record = this.buttons.get(this._normalizeButtonKey(id));
      if (!record) return false;
      record.image = Cast.toString(image || '').trim();
      this._applyButtonAppearance(record);
      return true;
    }

    setButtonVisible(id, visible) {
      const record = this.buttons.get(this._normalizeButtonKey(id));
      if (!record) return false;
      record.visible = Boolean(visible);
      if (!record.visible) this._resetButton(record, true);
      this._applyButtonAppearance(record);
      return true;
    }

    removeButton(id) {
      const key = this._normalizeButtonKey(id);
      const record = this.buttons.get(key);
      if (!record) return false;
      this._resetButton(record, true);
      if (record.element && record.element.parentNode) {
        record.element.parentNode.removeChild(record.element);
      }
      this.buttons.delete(key);
      return true;
    }

    removeAllButtons() {
      for (const record of Array.from(this.buttons.values())) this.removeButton(record.id);
    }

    // 旧版“跳跃按钮”兼容：映射为 ID=JUMP 的通用按钮。
    configureJump(enabled, relativeX, relativeY, size, color, text) {
      if (enabled) {
        this.createOrUpdateButton('JUMP', relativeX, relativeY, size, color, text || '跳');
      } else {
        this.setButtonVisible('JUMP', false);
      }
    }

    _buttonDown(record, event) {
      if (!this.enabled || !record.visible) return;
      event.preventDefault();
      const wasHeld = record.held;
      record.pointers.add(event.pointerId);
      record.held = true;
      if (record.element.setPointerCapture) {
        try { record.element.setPointerCapture(event.pointerId); } catch (_) {}
      }
      record.element.style.transform = 'translate(-50%, -50%) scale(0.9)';
      if (!wasHeld) {
        record.pressedAt = getNowMs();
        if (this.onButtonEvent) this.onButtonEvent(record.id, 'pressed');
      }
      this._notifyInput();
    }

    _buttonUp(record, event) {
      if (!record.pointers.has(event.pointerId)) return;
      event.preventDefault();
      record.pointers.delete(event.pointerId);
      record.held = record.pointers.size > 0;
      if (!record.held) {
        record.element.style.transform = 'translate(-50%, -50%) scale(1)';
        record.releasedAt = getNowMs();
        if (this.onButtonEvent) this.onButtonEvent(record.id, 'released');
      }
      this._notifyInput();
    }

    _resetButton(record, emitRelease = false) {
      if (!record) return;
      const wasHeld = record.held;
      record.pointers.clear();
      record.held = false;
      if (record.element) record.element.style.transform = 'translate(-50%, -50%) scale(1)';
      if (wasHeld) {
        record.releasedAt = getNowMs();
        if (emitRelease && this.onButtonEvent) this.onButtonEvent(record.id, 'released');
      }
    }

    _stickDown(event) {
      if (!this.enabled || this._stickPointerId !== null) return;
      event.preventDefault();
      this._stickPointerId = event.pointerId;
      this.active = true;
      if (this.outer.setPointerCapture) {
        try { this.outer.setPointerCapture(event.pointerId); } catch (_) {}
      }
      this._updateStickFromPointer(event.clientX, event.clientY);
    }

    _stickMove(event) {
      if (!this.enabled || event.pointerId !== this._stickPointerId) return;
      event.preventDefault();
      this._updateStickFromPointer(event.clientX, event.clientY);
    }

    _stickUp(event) {
      if (event.pointerId !== this._stickPointerId) return;
      event.preventDefault();
      this._stickPointerId = null;
      this.active = false;
      this.rawX = 0;
      this.rawY = 0;
      this.outputX = 0;
      this.outputY = 0;
      if (this.knob) {
        this.knob.style.transition = 'transform 90ms ease-out';
        this.knob.style.transform = 'translate(-50%, -50%)';
        globalEnv.setTimeout(() => {
          if (this.knob) this.knob.style.transition = 'none';
        }, 100);
      }
      this._notifyInput();
    }

    _updateStickFromPointer(clientX, clientY) {
      if (!this.outer || !this.knob) return;
      const rect = this.outer.getBoundingClientRect();
      const centerX = rect.left + rect.width * 0.5;
      const centerY = rect.top + rect.height * 0.5;
      const knobSize = this.outerSize * this.knobRatio;
      const maximum = Math.max(1, this.outerSize * 0.5 - knobSize * 0.5);
      let dx = finiteNumber(clientX, centerX) - centerX;
      let dy = finiteNumber(clientY, centerY) - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > maximum && distance > 0) {
        const scale = maximum / distance;
        dx *= scale;
        dy *= scale;
      }
      this.rawX = clamp(dx / maximum, -1, 1);
      this.rawY = clamp(-dy / maximum, -1, 1);
      this.knob.style.transition = 'none';
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this._recalculateOutput();
    }

    _recalculateOutput() {
      const magnitude = Math.min(1, Math.sqrt(this.rawX * this.rawX + this.rawY * this.rawY));
      if (!Number.isFinite(magnitude) || magnitude <= this.deadZone) {
        this.outputX = 0;
        this.outputY = 0;
        this._notifyInput();
        return;
      }
      const normalized = (magnitude - this.deadZone) / Math.max(0.000001, 1 - this.deadZone);
      let response = normalized;
      if (this.responseCurve === 'quadratic') response *= response;
      else if (this.responseCurve === 'cubic') response = response * response * response;
      const scale = response / magnitude;
      this.outputX = clamp(this.rawX * scale, -1, 1);
      this.outputY = clamp(this.rawY * scale, -1, 1);
      this._notifyInput();
    }

    _notifyInput() {
      if (this.onInput) this.onInput();
    }

    reset() {
      this._stickPointerId = null;
      this.active = false;
      this.rawX = 0;
      this.rawY = 0;
      this.outputX = 0;
      this.outputY = 0;
      if (this.knob) this.knob.style.transform = 'translate(-50%, -50%)';
      for (const record of this.buttons.values()) this._resetButton(record, false);
      this._notifyInput();
    }

    getInput() {
      const rawDistance = Math.min(1, Math.sqrt(this.rawX * this.rawX + this.rawY * this.rawY));
      let angle = 0;
      if (rawDistance > 1e-8) {
        // 0=上，90=右，180=下，270=左。
        angle = (Math.atan2(this.rawX, this.rawY) * 180 / Math.PI + 360) % 360;
      }
      if (!this.enabled) {
        return {x: 0, y: 0, jump: false, active: false, angle: 0, distance: 0};
      }
      return {
        x: Number.isFinite(this.outputX) ? this.outputX : 0,
        y: Number.isFinite(this.outputY) ? this.outputY : 0,
        jump: this.isButtonDown('JUMP'),
        active: Boolean(this.active),
        angle,
        distance: rawDistance
      };
    }

    getButtonState(id) {
      const record = this.buttons.get(this._normalizeButtonKey(id));
      if (!record) return {exists: false, held: false, justPressed: false, justReleased: false};
      const now = getNowMs();
      return {
        exists: true,
        held: Boolean(this.enabled && record.visible && record.held),
        justPressed: Boolean(this.enabled && record.visible && now - record.pressedAt <= 140),
        justReleased: Boolean(now - record.releasedAt <= 140)
      };
    }

    isButtonDown(id) {
      return this.getButtonState(id).held;
    }

    getButtonCount() {
      return this.buttons.size;
    }

    getBackendName() {
      if (!this.available) return '当前环境不支持 DOM PointerEvent 摇杆';
      return this.enabled ? `DOM PointerEvent 多点触控摇杆 + ${this.buttons.size} 个按钮` : '摇杆未开启';
    }
  }

  class UTBattleBoxExtension {
    constructor() {
      this.manager = new BattleWorldManager();
      this.gravity = new GravitySystem();
      this.soul = new Soul();
      this.controller = new SoulController(this.gravity);
      this.clock = new PhysicsClock(this.controller);
      this.tweenSystem = new BoxTweenSystem(
        this.manager,
        this._onBoxTweenCompleted.bind(this)
      );
      this.effectSystem = new BoxEffectSystem(
        this.manager,
        this._onBoxEffectCompleted.bind(this)
      );

      this.running = false;
      this.keyboardEnabled = true;
      this.visualInterpolationEnabled = true;
      // Pixel-stable is the Undertale-friendly default. In this mode a Camera V2-bound
      // soul uses nearest-neighbour sampling and skips sub-frame position interpolation,
      // avoiding apparent size pulsation at fractional camera zoom values.
      this.cameraSoulVisualMode = 'pixel';
      this._cameraSoulSamplingBinding = null;
      this._cameraSoulLastZoom = NaN;
      this._cameraSoulZoomChangedAt = -1;
      this._cameraSoulLastRepairAt = -Infinity;
      this._cameraSoulRepairCount = 0;
      this._cameraSoulScaleStatus = '等待绑定灵魂';
      this._lastSoulDisplayDrawableId = null;
      this._lastSoulDisplayWorldX = NaN;
      this._lastSoulDisplayWorldY = NaN;
      this.manualInputX = 0;
      this.manualInputY = 0;
      this.manualJumpDown = false;
      this.jumpBuffered = false;
      this._mobileJumpIntentWasDown = false;
      this.lastMobileButtonId = '';

      this.boundTarget = null;
      this.health = 20;
      this.lastHitId = '';
      this.lastHitDamage = 0;
      this.lastError = '';
      this.lastStatus = '未初始化战斗区域';
      this.lastCompletedTweenId = '';
      this.lastCompletedEffectId = '';
      this._recoveryHatWasActive = false;
      this._idleTweenLastTime = -1;
      this._idleTweenAccumulator = 0;
      this._effectLastTime = -1;
      this._keys = Object.create(null);
      this.mobileJoystick = new MobileJoystickController(
        this._onMobileButtonEvent.bind(this),
        this._onMobileInputChanged.bind(this)
      );

      this.clock.beforeFixedStep = this._beforeFixedStep.bind(this);
      this.clock.afterFixedStep = this._afterFixedStep.bind(this);
      this.visualizer = new BattleBoxRenderer(this.manager, this.effectSystem);
      this.performanceMode = PerformanceMode.AUTO;
      this.renderFpsLimit = 60;
      this._autoPerformanceLevel = 0;
      this._frameCostEma = 0;
      this._frameIntervalEma = 0;
      this._lastAnimationNow = -1;
      this._autoSlowScore = 0;
      this._autoFastScore = 0;
      this._lastVisualRenderMs = -Infinity;
      this._nextVisualRenderMs = -Infinity;
      this._visualPacingFps = 0;
      this._visualDeadlineResets = 0;
      this._scheduledVisualRenders = 0;
      this._scheduledVisualSkips = 0;
      this.visualizer.setPerformanceMode(this.performanceMode, this._autoPerformanceLevel);
      this._animationFrameHandle = null;
      this._animationFrameTimeoutHandle = null;
      this._animationFrameToken = 0;
      this._rafWatchdogHandle = null;
      this._frameRequestStartedAt = -Infinity;
      this._lastFrameDriverKind = '未启动';
      this._animationFrameBound = this._animationFrame.bind(this);
      this._keyDownBound = this._onKeyDown.bind(this);
      this._keyUpBound = this._onKeyUp.bind(this);
      this._blurBound = this._onBlur.bind(this);
      this._cameraScaleGuardInstalled = false;
      this._lastDirectCameraSoulTransform = false;
      this._cameraExclusiveTargetSync = false;

      if (runtime && typeof runtime.on === 'function') {
        runtime.on('PROJECT_STOP_ALL', () => {
          this.running = false;
          this.clock.reset();
          if (this.tweenSystem) this.tweenSystem.clear();
          if (this.effectSystem) this.effectSystem.clear();
          this._clearKeys();
          if (this.mobileJoystick) this.mobileJoystick.setEnabled(false);
          this._requestFrame();
        });
      }

      if (globalEnv.addEventListener) {
        globalEnv.addEventListener('keydown', this._keyDownBound, true);
        globalEnv.addEventListener('keyup', this._keyUpBound, true);
        globalEnv.addEventListener('blur', this._blurBound, true);
      }
      if (globalEnv.document && globalEnv.document.addEventListener) {
        globalEnv.document.addEventListener('keydown', this._keyDownBound, true);
        globalEnv.document.addEventListener('keyup', this._keyUpBound, true);
        globalEnv.document.addEventListener('visibilitychange', this._blurBound, true);
      }
    }

    getInfo() {
      const BlockType = ScratchAPI.BlockType;
      const ArgumentType = ScratchAPI.ArgumentType;
      const TargetType = ScratchAPI.TargetType;

      const organizePaletteBlocks = rawBlocks => {
        const LABEL_TYPE = BlockType.LABEL || 'label';
        const byOpcode = new Map();
        for (const block of rawBlocks) {
          if (block && typeof block === 'object' && block.opcode) {
            byOpcode.set(block.opcode, block);
          }
        }

        const sections = [
          {
            title: '系统与运行',
            items: [
              'resetSystem', 'startPhysics', 'stopPhysics', 'stepPhysicsOnce',
              'bindCurrentSprite', 'unbindSprite',
              '---',
              'isPhysicsRunning', 'getStatus', 'getLastError', 'getVersion'
            ]
          },
          {
            title: '框体区域（主框 / 加框 / 减框）',
            items: ['setAreaBox', 'setAreaPolygon', 'setAreaCircle', 'setAreaCapsule']
          },
          {
            title: '框体过渡（Tween / Easing）',
            items: [
              'startBoxTween', 'tweenBoxProperty', 'stopBoxTween', 'finishBoxTween',
              'stopAllBoxTweens', 'setBoxTweensPaused',
              '---',
              'whenBoxTweenCompleted', 'isBoxTweening', 'getBoxTweenProgress',
              'getBoxTweenCurve', 'getLastCompletedTweenId'
            ]
          },
          {
            title: '框体动效',
            items: [
              'setSingleBoxEffect', 'setAllBoxesEffect', 'stopSingleBoxEffect',
              'stopAllBoxesEffect', 'clearAllBoxEffects', 'setBoxEffectsPaused',
              'setBoxEffectRefreshRate',
              '---',
              'whenBoxEffectCompleted', 'isBoxEffectActive', 'getBoxEffectName',
              'getAllBoxesEffectName', 'getLastCompletedEffectId'
            ]
          },
          {
            title: '碰撞体与对象管理',
            items: [
              'setHitboxBox', 'setHitboxCircle', 'setHitboxCapsule',
              'setObjectTransform', 'setObjectEnabled', 'setHitboxDamage', 'deleteObject',
              '---',
              'objectExists', 'getObjectCount'
            ]
          },
          {
            title: '灵魂物理、重力与生命',
            items: [
              'setSoulPosition', 'setSoulRadius', 'setSoulMode', 'setGravityDirection',
              'setMovementProperties', 'setSoulMovementAlgorithm', 'setSlopeGripProperties',
              'setBlueSlopeGravitySlide', 'setExternalVelocity', 'setHealth',
              'setInvulnerabilityDuration',
              '---',
              'whenSoulHit', 'whenRecoveryFailed', 'getSoulX', 'getSoulY', 'getHealth',
              'isGrounded', 'isSurfaceSliding', 'isBlueSlopeGravitySliding',
              'recoveryFailed', 'getLastHitId', 'getLastHitDamage'
            ]
          },
          {
            title: '输入：键盘与手动输入',
            items: ['setKeyboardEnabled', 'setManualInput', '---', 'getInputBackend']
          },
          {
            title: '输入：手机摇杆',
            items: [
              'setJoystickEnabled', 'configureJoystickPosition', 'configureJoystickFeel',
              'configureJoystickColors', 'configureJoystickImages', 'configureJumpButton',
              '---',
              'getJoystickX', 'getJoystickY', 'getJoystickAngle', 'getJoystickDistance',
              'isJoystickActive'
            ]
          },
          {
            title: '输入：手机自定义按钮',
            items: [
              'createDefaultUTButtons', 'createMobileButton', 'setMobileButtonImage',
              'setMobileButtonVisible', 'removeMobileButton', 'removeAllMobileButtons',
              '---',
              'whenMobileButtonPressed', 'whenMobileButtonReleased', 'isMobileButtonDown',
              'wasMobileButtonPressed', 'wasMobileButtonReleased', 'getMobileButtonCount',
              'getLastMobileButtonId'
            ]
          },
          {
            title: '渲染、边框与调试',
            items: [
              'setRenderingEnabled', 'setRenderLayer', 'setRenderStyle',
              'setBattleBoxAntiAliasQuality', 'redrawBattleBox', 'setDebugRendering',
              '---',
              'getRenderBackend', 'getRenderLayerMode', 'getBattleBoxTextureScale'
            ]
          },
          {
            title: '背景材质（纯色 / 高斯 / 毛玻璃）',
            items: [
              'setBackgroundMaterial', 'setBlurMaterialSettings', 'setMaterialShade',
              'setGlassMaterialSettings', 'retryMaterialBackend',
              '---',
              'getBackgroundMaterial', 'getBackgroundMaterialBackend', 'getBlurAlgorithm'
            ]
          },
          {
            title: '角色图层代理与框内裁剪',
            items: [
              'replaceCurrentSpriteWithBox', 'restoreAllReplacedSprites',
              'clipCurrentSpriteToInterior', 'restoreAllInteriorClippedSprites',
              '---',
              'isCurrentSpriteReplaced', 'isCurrentSpriteInteriorClipped',
              'getInteriorClipBackend'
            ]
          },
          {
            title: 'Camera V2、自适应与显存保护',
            items: [
              'setVisualInterpolation', 'setCameraSoulVisualMode',
              'setAdaptiveCameraRendering', 'setGpuZoomMemoryGuard',
              '---',
              'getCameraCompatibilityStatus', 'getCameraSoulVisualDiagnostic',
              'getAdaptiveCameraRenderingStatus', 'getGpuMemoryGuardStatus'
            ]
          },
          {
            title: '性能控制与性能诊断',
            items: [
              'setPerformanceMode', 'setRenderFpsLimit', 'resetPerformanceStats',
              '---',
              'getPerformanceDiagnostic'
            ]
          }
        ];

        const result = [];
        const used = new Set();
        const appendSeparator = () => {
          if (result.length && result[result.length - 1] !== '---') result.push('---');
        };

        for (const section of sections) {
          appendSeparator();
          result.push({blockType: LABEL_TYPE, text: section.title});
          for (const item of section.items) {
            if (item === '---') {
              appendSeparator();
              continue;
            }
            const block = byOpcode.get(item);
            if (!block || used.has(item)) continue;
            result.push(block);
            used.add(item);
          }
        }

        // Safety net: new opcodes added in future versions remain available even if a
        // developer forgets to assign them to a section.
        const unassigned = rawBlocks.filter(block =>
          block && typeof block === 'object' && block.opcode && !used.has(block.opcode)
        );
        if (unassigned.length) {
          appendSeparator();
          result.push({blockType: LABEL_TYPE, text: '未分类兼容积木'});
          for (const block of unassigned) result.push(block);
        }

        return result;
      };

      const info = {
        id: EXTENSION_ID,
        name: 'UT战斗框 V21',
        color1: '#e74c3c',
        color2: '#c0392b',
        color3: '#922b21',
        blocks: [
          {
            opcode: 'resetSystem',
            blockType: BlockType.COMMAND,
            text: '重置 UT 战斗框系统'
          },
          {
            opcode: 'startPhysics',
            blockType: BlockType.COMMAND,
            text: '启动物理'
          },
          {
            opcode: 'stopPhysics',
            blockType: BlockType.COMMAND,
            text: '暂停物理'
          },
          {
            opcode: 'stepPhysicsOnce',
            blockType: BlockType.COMMAND,
            text: '执行一次物理步'
          },
          {
            opcode: 'bindCurrentSprite',
            blockType: BlockType.COMMAND,
            text: '绑定当前角色为灵魂并读取位置',
            filter: TargetType ? [TargetType.SPRITE] : undefined
          },
          {
            opcode: 'unbindSprite',
            blockType: BlockType.COMMAND,
            text: '解除灵魂角色绑定'
          },
          {
            opcode: 'setKeyboardEnabled',
            blockType: BlockType.COMMAND,
            text: '键盘控制 [STATE]',
            arguments: {
              STATE: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'on'}
            }
          },
          {
            opcode: 'setVisualInterpolation',
            blockType: BlockType.COMMAND,
            text: '灵魂显示平滑插值 [STATE]',
            arguments: {
              STATE: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'on'}
            }
          },
          {
            opcode: 'setCameraSoulVisualMode',
            blockType: BlockType.COMMAND,
            text: '摄像机灵魂显示 [MODE]',
            arguments: {
              MODE: {type: ArgumentType.STRING, menu: 'CAMERA_SOUL_VISUAL_MENU', defaultValue: 'pixel'}
            }
          },
          {
            opcode: 'setSoulMovementAlgorithm',
            blockType: BlockType.COMMAND,
            text: '灵魂移动算法 [ALGORITHM]',
            arguments: {
              ALGORITHM: {type: ArgumentType.STRING, menu: 'MOVEMENT_ALGORITHM_MENU', defaultValue: 'precise'}
            }
          },
          {
            opcode: 'setPerformanceMode',
            blockType: BlockType.COMMAND,
            text: '扩展性能模式 [MODE]',
            arguments: {
              MODE: {type: ArgumentType.STRING, menu: 'PERFORMANCE_MODE_MENU', defaultValue: 'auto'}
            }
          },
          {
            opcode: 'setRenderFpsLimit',
            blockType: BlockType.COMMAND,
            text: '战斗框最大渲染帧率 [FPS] FPS',
            arguments: {FPS: {type: ArgumentType.NUMBER, defaultValue: 60}}
          },
          {
            opcode: 'setJoystickEnabled',
            blockType: BlockType.COMMAND,
            text: '手机摇杆控制 [STATE]',
            arguments: {
              STATE: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'off'}
            }
          },
          {
            opcode: 'configureJoystickPosition',
            blockType: BlockType.COMMAND,
            text: '摇杆位置 横向 [X]% 纵向 [Y]% 外圈大小 [SIZE] 摇杆头 [KNOB]%',
            arguments: {
              X: {type: ArgumentType.NUMBER, defaultValue: 18},
              Y: {type: ArgumentType.NUMBER, defaultValue: 78},
              SIZE: {type: ArgumentType.NUMBER, defaultValue: 118},
              KNOB: {type: ArgumentType.NUMBER, defaultValue: 42}
            }
          },
          {
            opcode: 'configureJoystickFeel',
            blockType: BlockType.COMMAND,
            text: '摇杆死区 [DEADZONE]% 响应曲线 [CURVE]',
            arguments: {
              DEADZONE: {type: ArgumentType.NUMBER, defaultValue: 12},
              CURVE: {type: ArgumentType.STRING, menu: 'JOYSTICK_CURVE_MENU', defaultValue: 'linear'}
            }
          },
          {
            opcode: 'configureJoystickColors',
            blockType: BlockType.COMMAND,
            text: '摇杆外圈颜色 [OUTER] 内圈颜色 [INNER]',
            arguments: {
              OUTER: {type: ArgumentType.STRING, defaultValue: 'rgba(20,20,20,0.42)'},
              INNER: {type: ArgumentType.STRING, defaultValue: 'rgba(255,255,255,0.82)'}
            }
          },
          {
            opcode: 'configureJoystickImages',
            blockType: BlockType.COMMAND,
            text: '摇杆外圈图片 [OUTER] 内圈图片 [INNER]',
            arguments: {
              OUTER: {type: ArgumentType.STRING, defaultValue: ''},
              INNER: {type: ArgumentType.STRING, defaultValue: ''}
            }
          },
          {
            opcode: 'configureJumpButton',
            blockType: BlockType.COMMAND,
            text: '手机跳跃按钮 [STATE] 横向 [X]% 纵向 [Y]% 大小 [SIZE] 颜色 [COLOR] 文字 [TEXT]',
            hideFromPalette: true,
            arguments: {
              STATE: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'on'},
              X: {type: ArgumentType.NUMBER, defaultValue: 84},
              Y: {type: ArgumentType.NUMBER, defaultValue: 78},
              SIZE: {type: ArgumentType.NUMBER, defaultValue: 76},
              COLOR: {type: ArgumentType.STRING, defaultValue: 'rgba(255,255,255,0.64)'},
              TEXT: {type: ArgumentType.STRING, defaultValue: '跳'}
            }
          },
          {
            opcode: 'createMobileButton',
            blockType: BlockType.COMMAND,
            text: '创建/更新手机按钮 ID [ID] 横向 [X]% 纵向 [Y]% 大小 [SIZE] 颜色 [COLOR] 文字 [TEXT]',
            arguments: {
              ID: {type: ArgumentType.STRING, defaultValue: 'Z'},
              X: {type: ArgumentType.NUMBER, defaultValue: 84},
              Y: {type: ArgumentType.NUMBER, defaultValue: 79},
              SIZE: {type: ArgumentType.NUMBER, defaultValue: 72},
              COLOR: {type: ArgumentType.STRING, defaultValue: 'rgba(255,235,120,0.76)'},
              TEXT: {type: ArgumentType.STRING, defaultValue: 'Z'}
            }
          },
          {
            opcode: 'setMobileButtonImage',
            blockType: BlockType.COMMAND,
            text: '设置手机按钮 ID [ID] 图片 [IMAGE]',
            arguments: {
              ID: {type: ArgumentType.STRING, defaultValue: 'Z'},
              IMAGE: {type: ArgumentType.STRING, defaultValue: ''}
            }
          },
          {
            opcode: 'setMobileButtonVisible',
            blockType: BlockType.COMMAND,
            text: '手机按钮 ID [ID] [STATE]',
            arguments: {
              ID: {type: ArgumentType.STRING, defaultValue: 'Z'},
              STATE: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'on'}
            }
          },
          {
            opcode: 'removeMobileButton',
            blockType: BlockType.COMMAND,
            text: '删除手机按钮 ID [ID]',
            arguments: {ID: {type: ArgumentType.STRING, defaultValue: 'Z'}}
          },
          {
            opcode: 'removeAllMobileButtons',
            blockType: BlockType.COMMAND,
            text: '删除所有手机按钮'
          },
          {
            opcode: 'createDefaultUTButtons',
            blockType: BlockType.COMMAND,
            text: '创建默认 UT 手机按钮 Z / X / C'
          },
          {
            opcode: 'setRenderingEnabled',
            blockType: BlockType.COMMAND,
            text: '战斗框舞台渲染 [STATE]',
            arguments: {
              STATE: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'on'}
            }
          },
          {
            opcode: 'setRenderLayer',
            blockType: BlockType.COMMAND,
            text: '战斗框渲染层 [LAYER]',
            arguments: {
              LAYER: {type: ArgumentType.STRING, menu: 'RENDER_LAYER_MENU', defaultValue: 'behind'}
            }
          },
          {
            opcode: 'replaceCurrentSpriteWithBox',
            blockType: BlockType.COMMAND,
            text: '用框替换当前角色 [STATE]',
            filter: TargetType ? [TargetType.SPRITE] : undefined,
            arguments: {
              STATE: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'on'}
            }
          },
          {
            opcode: 'restoreAllReplacedSprites',
            blockType: BlockType.COMMAND,
            text: '恢复所有被框替换的角色'
          },
          {
            opcode: 'isCurrentSpriteReplaced',
            blockType: BlockType.BOOLEAN,
            text: '当前角色正被框替换？',
            filter: TargetType ? [TargetType.SPRITE] : undefined
          },
          {
            opcode: 'clipCurrentSpriteToInterior',
            blockType: BlockType.COMMAND,
            text: '限制当前角色只在战斗框内部显示 [STATE]',
            filter: TargetType ? [TargetType.SPRITE] : undefined,
            arguments: {
              STATE: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'on'}
            }
          },
          {
            opcode: 'restoreAllInteriorClippedSprites',
            blockType: BlockType.COMMAND,
            text: '恢复所有框内裁剪角色'
          },
          {
            opcode: 'isCurrentSpriteInteriorClipped',
            blockType: BlockType.BOOLEAN,
            text: '当前角色正在被框内裁剪？',
            filter: TargetType ? [TargetType.SPRITE] : undefined
          },
          {
            opcode: 'setRenderStyle',
            blockType: BlockType.COMMAND,
            text: '设置框边颜色 [COLOR] 粗细 [WIDTH] 内部不透明度 [ALPHA]%',
            arguments: {
              COLOR: {type: ArgumentType.COLOR || ArgumentType.STRING, defaultValue: '#ffffff'},
              WIDTH: {type: ArgumentType.NUMBER, defaultValue: 4},
              ALPHA: {type: ArgumentType.NUMBER, defaultValue: 28}
            }
          },
          {
            opcode: 'setBattleBoxAntiAliasQuality',
            blockType: BlockType.COMMAND,
            text: '战斗框抗锯齿质量 [QUALITY]',
            arguments: {
              QUALITY: {type: ArgumentType.STRING, menu: 'ANTIALIAS_QUALITY_MENU', defaultValue: 'auto'}
            }
          },
          {
            opcode: 'setAdaptiveCameraRendering',
            blockType: BlockType.COMMAND,
            text: '摄像机自适应渲染 [STATE] 预留 [MARGIN] 像素 最大范围 [MAX] 倍',
            arguments: {
              STATE: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'on'},
              MARGIN: {type: ArgumentType.NUMBER, defaultValue: 96},
              MAX: {type: ArgumentType.NUMBER, defaultValue: 4}
            }
          },
          {
            opcode: 'setGpuZoomMemoryGuard',
            blockType: BlockType.COMMAND,
            text: '摄像机缩放显存保护 [STATE] 稳定等待 [WAIT] 毫秒 纹理预算 [BUDGET] 百万像素',
            arguments: {
              STATE: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'on'},
              WAIT: {type: ArgumentType.NUMBER, defaultValue: 220},
              BUDGET: {type: ArgumentType.NUMBER, defaultValue: 3}
            }
          },
          {
            opcode: 'setBackgroundMaterial',
            blockType: BlockType.COMMAND,
            text: '战斗框背景材质 [MATERIAL]',
            arguments: {
              MATERIAL: {type: ArgumentType.STRING, menu: 'BACKGROUND_MATERIAL_MENU', defaultValue: 'solid'}
            }
          },
          {
            opcode: 'setBlurMaterialSettings',
            blockType: BlockType.COMMAND,
            text: '背景模糊半径 [RADIUS] 刷新率 [FPS] FPS',
            arguments: {
              RADIUS: {type: ArgumentType.NUMBER, defaultValue: 10},
              FPS: {type: ArgumentType.NUMBER, defaultValue: 12}
            }
          },
          {
            opcode: 'setMaterialShade',
            blockType: BlockType.COMMAND,
            text: '动态背景暗度 [ALPHA]%',
            arguments: {
              ALPHA: {type: ArgumentType.NUMBER, defaultValue: 18}
            }
          },
          {
            opcode: 'retryMaterialBackend',
            blockType: BlockType.COMMAND,
            text: '重新检测背景材质后端'
          },
          {
            opcode: 'setGlassMaterialSettings',
            blockType: BlockType.COMMAND,
            text: '毛玻璃染色 [COLOR] 不透明度 [ALPHA]% 饱和度 [SATURATION]% 颗粒 [NOISE]%',
            arguments: {
              COLOR: {type: ArgumentType.COLOR || ArgumentType.STRING, defaultValue: '#dcecff'},
              ALPHA: {type: ArgumentType.NUMBER, defaultValue: 22},
              SATURATION: {type: ArgumentType.NUMBER, defaultValue: 125},
              NOISE: {type: ArgumentType.NUMBER, defaultValue: 3.5}
            }
          },
          {
            opcode: 'setDebugRendering',
            blockType: BlockType.COMMAND,
            text: '碰撞体调试渲染 [STATE]',
            arguments: {
              STATE: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'off'}
            }
          },
          {
            opcode: 'redrawBattleBox',
            blockType: BlockType.COMMAND,
            text: '立即重绘战斗框'
          },
          {
            opcode: 'setManualInput',
            blockType: BlockType.COMMAND,
            text: '设置手动输入 x [X] y [Y] 跳跃 [JUMP]',
            arguments: {
              X: {type: ArgumentType.NUMBER, defaultValue: 0},
              Y: {type: ArgumentType.NUMBER, defaultValue: 0},
              JUMP: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'off'}
            }
          },
          '---',
          {
            opcode: 'setAreaBox',
            blockType: BlockType.COMMAND,
            text: '设置 [ROLE] 圆角框 ID [ID] 中心 x [X] y [Y] 宽 [W] 高 [H] 圆角 [R]',
            arguments: {
              ROLE: {type: ArgumentType.STRING, menu: 'AREA_ROLE_MENU', defaultValue: 'base'},
              ID: {type: ArgumentType.STRING, defaultValue: 'main'},
              X: {type: ArgumentType.NUMBER, defaultValue: 0},
              Y: {type: ArgumentType.NUMBER, defaultValue: 0},
              W: {type: ArgumentType.NUMBER, defaultValue: 200},
              H: {type: ArgumentType.NUMBER, defaultValue: 140},
              R: {type: ArgumentType.NUMBER, defaultValue: 0}
            }
          },
          {
            opcode: 'setAreaCircle',
            blockType: BlockType.COMMAND,
            hideFromPalette: true,
            text: '设置 [ROLE] 圆形框 ID [ID] 中心 x [X] y [Y] 半径 [R]',
            arguments: {
              ROLE: {type: ArgumentType.STRING, menu: 'AREA_ROLE_MENU', defaultValue: 'add'},
              ID: {type: ArgumentType.STRING, defaultValue: 'circle1'},
              X: {type: ArgumentType.NUMBER, defaultValue: 0},
              Y: {type: ArgumentType.NUMBER, defaultValue: 0},
              R: {type: ArgumentType.NUMBER, defaultValue: 50}
            }
          },
          {
            opcode: 'setAreaCapsule',
            blockType: BlockType.COMMAND,
            hideFromPalette: true,
            text: '设置 [ROLE] 胶囊框 ID [ID] 中心 x [X] y [Y] 半高 [HH] 半径 [R] 旋转 [ROT] 度',
            arguments: {
              ROLE: {type: ArgumentType.STRING, menu: 'AREA_ROLE_MENU', defaultValue: 'add'},
              ID: {type: ArgumentType.STRING, defaultValue: 'capsule1'},
              X: {type: ArgumentType.NUMBER, defaultValue: 0},
              Y: {type: ArgumentType.NUMBER, defaultValue: 0},
              HH: {type: ArgumentType.NUMBER, defaultValue: 50},
              R: {type: ArgumentType.NUMBER, defaultValue: 20},
              ROT: {type: ArgumentType.NUMBER, defaultValue: 0}
            }
          },
          {
            opcode: 'setAreaPolygon',
            blockType: BlockType.COMMAND,
            text: '设置 [ROLE] 多边形框 ID [ID] 中心 x [X] y [Y] 顶点 [POINTS] 旋转 [ROT] 度',
            arguments: {
              ROLE: {type: ArgumentType.STRING, menu: 'AREA_ROLE_MENU', defaultValue: 'base'},
              ID: {type: ArgumentType.STRING, defaultValue: 'polygon1'},
              X: {type: ArgumentType.NUMBER, defaultValue: 0},
              Y: {type: ArgumentType.NUMBER, defaultValue: 0},
              POINTS: {type: ArgumentType.STRING, defaultValue: '0,70 90,-50 -90,-50'},
              ROT: {type: ArgumentType.NUMBER, defaultValue: 0}
            }
          },
          '---',
          {
            opcode: 'startBoxTween',
            blockType: BlockType.COMMAND,
            text: '让圆角框 ID [ID] 在 [SECONDS] 秒内变为 x [X] y [Y] 宽 [W] 高 [H] 圆角 [R] 旋转 [ROT] 曲线 [CURVE] [DIRECTION] 冲突 [CONFLICT]',
            arguments: {
              ID: {type: ArgumentType.STRING, defaultValue: 'main'},
              SECONDS: {type: ArgumentType.NUMBER, defaultValue: 0.6},
              X: {type: ArgumentType.NUMBER, defaultValue: 0},
              Y: {type: ArgumentType.NUMBER, defaultValue: 0},
              W: {type: ArgumentType.NUMBER, defaultValue: 240},
              H: {type: ArgumentType.NUMBER, defaultValue: 120},
              R: {type: ArgumentType.NUMBER, defaultValue: 24},
              ROT: {type: ArgumentType.NUMBER, defaultValue: 0},
              CURVE: {type: ArgumentType.STRING, menu: 'EASING_CURVE_MENU', defaultValue: 'cubic'},
              DIRECTION: {type: ArgumentType.STRING, menu: 'EASING_DIRECTION_MENU', defaultValue: 'out'},
              CONFLICT: {type: ArgumentType.STRING, menu: 'TWEEN_CONFLICT_MENU', defaultValue: 'replace'}
            }
          },
          {
            opcode: 'tweenBoxProperty',
            blockType: BlockType.COMMAND,
            text: '让圆角框 ID [ID] 的 [PROPERTY] 在 [SECONDS] 秒内变为 [VALUE] 曲线 [CURVE] [DIRECTION] 冲突 [CONFLICT]',
            arguments: {
              ID: {type: ArgumentType.STRING, defaultValue: 'main'},
              PROPERTY: {type: ArgumentType.STRING, menu: 'TWEEN_PROPERTY_MENU', defaultValue: 'x'},
              SECONDS: {type: ArgumentType.NUMBER, defaultValue: 0.5},
              VALUE: {type: ArgumentType.NUMBER, defaultValue: 50},
              CURVE: {type: ArgumentType.STRING, menu: 'EASING_CURVE_MENU', defaultValue: 'cubic'},
              DIRECTION: {type: ArgumentType.STRING, menu: 'EASING_DIRECTION_MENU', defaultValue: 'out'},
              CONFLICT: {type: ArgumentType.STRING, menu: 'TWEEN_CONFLICT_MENU', defaultValue: 'replace'}
            }
          },
          {
            opcode: 'stopBoxTween',
            blockType: BlockType.COMMAND,
            text: '停止圆角框 ID [ID] 的过渡',
            arguments: {ID: {type: ArgumentType.STRING, defaultValue: 'main'}}
          },
          {
            opcode: 'finishBoxTween',
            blockType: BlockType.COMMAND,
            text: '立即完成圆角框 ID [ID] 的当前过渡',
            arguments: {ID: {type: ArgumentType.STRING, defaultValue: 'main'}}
          },
          {
            opcode: 'stopAllBoxTweens',
            blockType: BlockType.COMMAND,
            text: '停止所有框过渡'
          },
          {
            opcode: 'setBoxTweensPaused',
            blockType: BlockType.COMMAND,
            text: '暂停所有框过渡 [STATE]',
            arguments: {STATE: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'on'}}
          },
          {
            opcode: 'isBoxTweening',
            blockType: BlockType.BOOLEAN,
            text: '圆角框 ID [ID] 正在过渡？',
            arguments: {ID: {type: ArgumentType.STRING, defaultValue: 'main'}}
          },
          {
            opcode: 'getBoxTweenProgress',
            blockType: BlockType.REPORTER,
            text: '圆角框 ID [ID] 过渡进度 %',
            arguments: {ID: {type: ArgumentType.STRING, defaultValue: 'main'}},
            disableMonitor: true
          },
          {
            opcode: 'getBoxTweenCurve',
            blockType: BlockType.REPORTER,
            text: '圆角框 ID [ID] 当前曲线',
            arguments: {ID: {type: ArgumentType.STRING, defaultValue: 'main'}},
            disableMonitor: true
          },
          '---',
          {
            opcode: 'setSingleBoxEffect',
            blockType: BlockType.COMMAND,
            text: '设置单框 ID [ID] 动效 [EFFECT] 强度 [STRENGTH] 速度 [SPEED] 持续 [SECONDS] 秒 模式 [MODE]',
            arguments: {
              ID: {type: ArgumentType.STRING, defaultValue: 'main'},
              EFFECT: {type: ArgumentType.STRING, menu: 'BOX_EFFECT_MENU', defaultValue: 'shake'},
              STRENGTH: {type: ArgumentType.NUMBER, defaultValue: 6},
              SPEED: {type: ArgumentType.NUMBER, defaultValue: 4},
              SECONDS: {type: ArgumentType.NUMBER, defaultValue: 0},
              MODE: {type: ArgumentType.STRING, menu: 'BOX_EFFECT_MODE_MENU', defaultValue: 'visual'}
            }
          },
          {
            opcode: 'setAllBoxesEffect',
            blockType: BlockType.COMMAND,
            text: '设置全部框动效 [EFFECT] 强度 [STRENGTH] 速度 [SPEED] 持续 [SECONDS] 秒 模式 [MODE]',
            arguments: {
              EFFECT: {type: ArgumentType.STRING, menu: 'BOX_EFFECT_MENU', defaultValue: 'shake'},
              STRENGTH: {type: ArgumentType.NUMBER, defaultValue: 6},
              SPEED: {type: ArgumentType.NUMBER, defaultValue: 4},
              SECONDS: {type: ArgumentType.NUMBER, defaultValue: 0},
              MODE: {type: ArgumentType.STRING, menu: 'BOX_EFFECT_MODE_MENU', defaultValue: 'visual'}
            }
          },
          {
            opcode: 'stopSingleBoxEffect',
            blockType: BlockType.COMMAND,
            text: '停止单框 ID [ID] 动效',
            arguments: {ID: {type: ArgumentType.STRING, defaultValue: 'main'}}
          },
          {
            opcode: 'stopAllBoxesEffect',
            blockType: BlockType.COMMAND,
            text: '停止全部框统一动效'
          },
          {
            opcode: 'clearAllBoxEffects',
            blockType: BlockType.COMMAND,
            text: '清除所有框动效'
          },
          {
            opcode: 'setBoxEffectsPaused',
            blockType: BlockType.COMMAND,
            text: '暂停框动效 [STATE]',
            arguments: {STATE: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'on'}}
          },
          {
            opcode: 'setBoxEffectRefreshRate',
            blockType: BlockType.COMMAND,
            text: '框动效刷新率 [FPS] FPS',
            arguments: {FPS: {type: ArgumentType.NUMBER, defaultValue: 30}}
          },
          {
            opcode: 'isBoxEffectActive',
            blockType: BlockType.BOOLEAN,
            text: '框 ID [ID] 有动效？',
            arguments: {ID: {type: ArgumentType.STRING, defaultValue: 'main'}}
          },
          {
            opcode: 'getBoxEffectName',
            blockType: BlockType.REPORTER,
            text: '框 ID [ID] 当前动效',
            arguments: {ID: {type: ArgumentType.STRING, defaultValue: 'main'}},
            disableMonitor: true
          },
          {
            opcode: 'getAllBoxesEffectName',
            blockType: BlockType.REPORTER,
            text: '全部框当前统一动效',
            disableMonitor: true
          },
          '---',
          {
            opcode: 'setHitboxBox',
            blockType: BlockType.COMMAND,
            text: '设置矩形碰撞体 ID [ID] 类型 [RESPONSE] 层 [LAYER] 伤害 [DAMAGE] x [X] y [Y] 宽 [W] 高 [H] 圆角 [R] 旋转 [ROT]',
            arguments: {
              ID: {type: ArgumentType.STRING, defaultValue: 'hitbox1'},
              RESPONSE: {type: ArgumentType.STRING, menu: 'RESPONSE_MENU', defaultValue: 'trigger'},
              LAYER: {type: ArgumentType.STRING, menu: 'LAYER_MENU', defaultValue: 'bullet'},
              DAMAGE: {type: ArgumentType.NUMBER, defaultValue: 1},
              X: {type: ArgumentType.NUMBER, defaultValue: 0},
              Y: {type: ArgumentType.NUMBER, defaultValue: 0},
              W: {type: ArgumentType.NUMBER, defaultValue: 20},
              H: {type: ArgumentType.NUMBER, defaultValue: 80},
              R: {type: ArgumentType.NUMBER, defaultValue: 0},
              ROT: {type: ArgumentType.NUMBER, defaultValue: 0}
            }
          },
          {
            opcode: 'setHitboxCircle',
            blockType: BlockType.COMMAND,
            text: '设置圆形碰撞体 ID [ID] 类型 [RESPONSE] 层 [LAYER] 伤害 [DAMAGE] x [X] y [Y] 半径 [R]',
            arguments: {
              ID: {type: ArgumentType.STRING, defaultValue: 'bullet1'},
              RESPONSE: {type: ArgumentType.STRING, menu: 'RESPONSE_MENU', defaultValue: 'trigger'},
              LAYER: {type: ArgumentType.STRING, menu: 'LAYER_MENU', defaultValue: 'bullet'},
              DAMAGE: {type: ArgumentType.NUMBER, defaultValue: 1},
              X: {type: ArgumentType.NUMBER, defaultValue: 0},
              Y: {type: ArgumentType.NUMBER, defaultValue: 0},
              R: {type: ArgumentType.NUMBER, defaultValue: 8}
            }
          },
          {
            opcode: 'setHitboxCapsule',
            blockType: BlockType.COMMAND,
            text: '设置胶囊碰撞体 ID [ID] 类型 [RESPONSE] 层 [LAYER] 伤害 [DAMAGE] x [X] y [Y] 半高 [HH] 半径 [R] 旋转 [ROT]',
            arguments: {
              ID: {type: ArgumentType.STRING, defaultValue: 'laser1'},
              RESPONSE: {type: ArgumentType.STRING, menu: 'RESPONSE_MENU', defaultValue: 'trigger'},
              LAYER: {type: ArgumentType.STRING, menu: 'LAYER_MENU', defaultValue: 'laser'},
              DAMAGE: {type: ArgumentType.NUMBER, defaultValue: 1},
              X: {type: ArgumentType.NUMBER, defaultValue: 0},
              Y: {type: ArgumentType.NUMBER, defaultValue: 0},
              HH: {type: ArgumentType.NUMBER, defaultValue: 80},
              R: {type: ArgumentType.NUMBER, defaultValue: 5},
              ROT: {type: ArgumentType.NUMBER, defaultValue: 90}
            }
          },
          {
            opcode: 'setObjectTransform',
            blockType: BlockType.COMMAND,
            text: '设置对象 ID [ID] 变换 x [X] y [Y] 旋转 [ROT] 缩放 x [SX] y [SY]',
            arguments: {
              ID: {type: ArgumentType.STRING, defaultValue: 'main'},
              X: {type: ArgumentType.NUMBER, defaultValue: 0},
              Y: {type: ArgumentType.NUMBER, defaultValue: 0},
              ROT: {type: ArgumentType.NUMBER, defaultValue: 0},
              SX: {type: ArgumentType.NUMBER, defaultValue: 1},
              SY: {type: ArgumentType.NUMBER, defaultValue: 1}
            }
          },
          {
            opcode: 'setObjectEnabled',
            blockType: BlockType.COMMAND,
            text: '设置对象 ID [ID] 启用 [STATE]',
            arguments: {
              ID: {type: ArgumentType.STRING, defaultValue: 'main'},
              STATE: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'on'}
            }
          },
          {
            opcode: 'setHitboxDamage',
            blockType: BlockType.COMMAND,
            text: '设置碰撞体 ID [ID] 伤害 [DAMAGE]',
            arguments: {
              ID: {type: ArgumentType.STRING, defaultValue: 'bullet1'},
              DAMAGE: {type: ArgumentType.NUMBER, defaultValue: 1}
            }
          },
          {
            opcode: 'deleteObject',
            blockType: BlockType.COMMAND,
            text: '删除对象 ID [ID]',
            arguments: {
              ID: {type: ArgumentType.STRING, defaultValue: 'main'}
            }
          },
          '---',
          {
            opcode: 'setSoulPosition',
            blockType: BlockType.COMMAND,
            text: '设置灵魂位置 x [X] y [Y]',
            arguments: {
              X: {type: ArgumentType.NUMBER, defaultValue: 0},
              Y: {type: ArgumentType.NUMBER, defaultValue: 0}
            }
          },
          {
            opcode: 'setSoulRadius',
            blockType: BlockType.COMMAND,
            text: '设置灵魂半径 [R]',
            arguments: {
              R: {type: ArgumentType.NUMBER, defaultValue: 8}
            }
          },
          {
            opcode: 'setSoulMode',
            blockType: BlockType.COMMAND,
            text: '设置灵魂模式 [MODE]',
            arguments: {
              MODE: {type: ArgumentType.STRING, menu: 'SOUL_MODE_MENU', defaultValue: 'red'}
            }
          },
          {
            opcode: 'setGravityDirection',
            blockType: BlockType.COMMAND,
            text: '设置蓝魂重力方向 [DIRECTION]',
            arguments: {
              DIRECTION: {type: ArgumentType.STRING, menu: 'GRAVITY_MENU', defaultValue: 'down'}
            }
          },
          {
            opcode: 'setMovementProperties',
            blockType: BlockType.COMMAND,
            text: '设置移动速度 [SPEED] 跳跃力 [JUMP] 重力 [GRAVITY] 最大下落 [MAXFALL]',
            arguments: {
              SPEED: {type: ArgumentType.NUMBER, defaultValue: 180},
              JUMP: {type: ArgumentType.NUMBER, defaultValue: 360},
              GRAVITY: {type: ArgumentType.NUMBER, defaultValue: 1440},
              MAXFALL: {type: ArgumentType.NUMBER, defaultValue: 480}
            }
          },
          {
            opcode: 'setSlopeGripProperties',
            blockType: BlockType.COMMAND,
            text: '斜面蹭墙 [STATE] 探测距离 [DIST] 速度保持 [PERCENT]%',
            arguments: {
              STATE: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'on'},
              DIST: {type: ArgumentType.NUMBER, defaultValue: 1.25},
              PERCENT: {type: ArgumentType.NUMBER, defaultValue: 100}
            }
          },
          {
            opcode: 'setBlueSlopeGravitySlide',
            blockType: BlockType.COMMAND,
            text: '蓝魂斜墙自然下滑 [STATE] 重力比例 [PERCENT]%',
            arguments: {
              STATE: {type: ArgumentType.STRING, menu: 'ON_OFF_MENU', defaultValue: 'on'},
              PERCENT: {type: ArgumentType.NUMBER, defaultValue: 100}
            }
          },
          {
            opcode: 'setExternalVelocity',
            blockType: BlockType.COMMAND,
            text: '设置灵魂外力速度 x [X] y [Y]',
            arguments: {
              X: {type: ArgumentType.NUMBER, defaultValue: 0},
              Y: {type: ArgumentType.NUMBER, defaultValue: 0}
            }
          },
          {
            opcode: 'setHealth',
            blockType: BlockType.COMMAND,
            text: '设置灵魂生命 [HP]',
            arguments: {
              HP: {type: ArgumentType.NUMBER, defaultValue: 20}
            }
          },
          {
            opcode: 'setInvulnerabilityDuration',
            blockType: BlockType.COMMAND,
            text: '设置受伤无敌时间 [SECONDS] 秒',
            arguments: {
              SECONDS: {type: ArgumentType.NUMBER, defaultValue: 1}
            }
          },
          '---',
          {
            opcode: 'whenSoulHit',
            blockType: BlockType.EVENT,
            text: '当灵魂受伤',
            isEdgeActivated: false
          },
          {
            opcode: 'whenRecoveryFailed',
            blockType: BlockType.EVENT,
            text: '当物理恢复失败',
            isEdgeActivated: false
          },
          {
            opcode: 'whenBoxTweenCompleted',
            blockType: BlockType.EVENT,
            text: '当圆角框 ID [ID] 过渡完成',
            isEdgeActivated: false,
            arguments: {ID: {type: ArgumentType.STRING, defaultValue: 'main'}}
          },
          {
            opcode: 'whenBoxEffectCompleted',
            blockType: BlockType.EVENT,
            text: '当框动效 [ID] 完成',
            isEdgeActivated: false,
            arguments: {ID: {type: ArgumentType.STRING, defaultValue: 'main'}}
          },
          {
            opcode: 'whenMobileButtonPressed',
            blockType: BlockType.EVENT,
            text: '当手机按钮 ID [ID] 被按下',
            isEdgeActivated: false,
            arguments: {ID: {type: ArgumentType.STRING, defaultValue: 'Z'}}
          },
          {
            opcode: 'whenMobileButtonReleased',
            blockType: BlockType.EVENT,
            text: '当手机按钮 ID [ID] 被松开',
            isEdgeActivated: false,
            arguments: {ID: {type: ArgumentType.STRING, defaultValue: 'Z'}}
          },
          {
            opcode: 'getLastCompletedTweenId',
            blockType: BlockType.REPORTER,
            text: '最后完成过渡的框 ID',
            disableMonitor: true
          },
          {
            opcode: 'getLastCompletedEffectId',
            blockType: BlockType.REPORTER,
            text: '最后完成动效的框 ID',
            disableMonitor: true
          },
          {
            opcode: 'getSoulX',
            blockType: BlockType.REPORTER,
            text: '灵魂 x',
            disableMonitor: false
          },
          {
            opcode: 'getSoulY',
            blockType: BlockType.REPORTER,
            text: '灵魂 y',
            disableMonitor: false
          },
          {
            opcode: 'getHealth',
            blockType: BlockType.REPORTER,
            text: '灵魂生命',
            disableMonitor: false
          },
          {
            opcode: 'isGrounded',
            blockType: BlockType.BOOLEAN,
            text: '灵魂着地？',
            disableMonitor: false
          },
          {
            opcode: 'isSurfaceSliding',
            blockType: BlockType.BOOLEAN,
            text: '灵魂正在斜面蹭墙？',
            disableMonitor: false
          },
          {
            opcode: 'isBlueSlopeGravitySliding',
            blockType: BlockType.BOOLEAN,
            text: '蓝魂正在沿斜墙下滑？',
            disableMonitor: false
          },
          {
            opcode: 'isPhysicsRunning',
            blockType: BlockType.BOOLEAN,
            text: '物理正在运行？',
            disableMonitor: false
          },
          {
            opcode: 'recoveryFailed',
            blockType: BlockType.BOOLEAN,
            text: '物理恢复失败？',
            disableMonitor: false
          },
          {
            opcode: 'getLastHitId',
            blockType: BlockType.REPORTER,
            text: '最后命中碰撞体 ID',
            disableMonitor: true
          },
          {
            opcode: 'getLastHitDamage',
            blockType: BlockType.REPORTER,
            text: '最后受到伤害',
            disableMonitor: true
          },
          {
            opcode: 'objectExists',
            blockType: BlockType.BOOLEAN,
            text: '对象 ID [ID] 存在？',
            arguments: {
              ID: {type: ArgumentType.STRING, defaultValue: 'main'}
            }
          },
          {
            opcode: 'getObjectCount',
            blockType: BlockType.REPORTER,
            text: '对象数量',
            disableMonitor: true
          },
          {
            opcode: 'getLastError',
            blockType: BlockType.REPORTER,
            text: '最后错误',
            disableMonitor: true
          },
          {
            opcode: 'getStatus',
            blockType: BlockType.REPORTER,
            text: '系统状态',
            disableMonitor: true
          },
          {
            opcode: 'getRenderBackend',
            blockType: BlockType.REPORTER,
            text: '战斗框渲染后端',
            disableMonitor: true
          },
          {
            opcode: 'getRenderLayerMode',
            blockType: BlockType.REPORTER,
            text: '战斗框图层模式',
            disableMonitor: true
          },
          {
            opcode: 'getBackgroundMaterial',
            blockType: BlockType.REPORTER,
            text: '战斗框背景材质',
            disableMonitor: true
          },
          {
            opcode: 'getBackgroundMaterialBackend',
            blockType: BlockType.REPORTER,
            text: '背景材质采样后端',
            disableMonitor: true
          },
          {
            opcode: 'getBlurAlgorithm',
            blockType: BlockType.REPORTER,
            text: '背景模糊算法',
            disableMonitor: true
          },
          {
            opcode: 'getBattleBoxTextureScale',
            blockType: BlockType.REPORTER,
            text: '战斗框纹理倍率',
            disableMonitor: true
          },
          {
            opcode: 'getCameraCompatibilityStatus',
            blockType: BlockType.REPORTER,
            text: '摄像机兼容状态',
            disableMonitor: true
          },
          {
            opcode: 'getCameraSoulVisualDiagnostic',
            blockType: BlockType.REPORTER,
            text: '灵魂摄像机显示诊断',
            disableMonitor: true
          },
          {
            opcode: 'getAdaptiveCameraRenderingStatus',
            blockType: BlockType.REPORTER,
            text: '摄像机自适应渲染范围',
            disableMonitor: true
          },
          {
            opcode: 'getGpuMemoryGuardStatus',
            blockType: BlockType.REPORTER,
            text: 'GPU 显存保护状态',
            disableMonitor: true
          },
          {
            opcode: 'getInteriorClipBackend',
            blockType: BlockType.REPORTER,
            text: '框内精灵裁剪后端',
            disableMonitor: true
          },
          {
            opcode: 'getJoystickX',
            blockType: BlockType.REPORTER,
            text: '手机摇杆 x',
            disableMonitor: false
          },
          {
            opcode: 'getJoystickY',
            blockType: BlockType.REPORTER,
            text: '手机摇杆 y',
            disableMonitor: false
          },
          {
            opcode: 'getJoystickAngle',
            blockType: BlockType.REPORTER,
            text: '手机摇杆角度',
            disableMonitor: false
          },
          {
            opcode: 'getJoystickDistance',
            blockType: BlockType.REPORTER,
            text: '手机摇杆离原点距离 %',
            disableMonitor: false
          },
          {
            opcode: 'isJoystickActive',
            blockType: BlockType.BOOLEAN,
            text: '手机摇杆正在使用？',
            disableMonitor: false
          },
          {
            opcode: 'isMobileButtonDown',
            blockType: BlockType.BOOLEAN,
            text: '手机按钮 ID [ID] 正按下？',
            arguments: {ID: {type: ArgumentType.STRING, defaultValue: 'Z'}},
            disableMonitor: false
          },
          {
            opcode: 'wasMobileButtonPressed',
            blockType: BlockType.BOOLEAN,
            text: '手机按钮 ID [ID] 刚按下？',
            arguments: {ID: {type: ArgumentType.STRING, defaultValue: 'Z'}},
            disableMonitor: false
          },
          {
            opcode: 'wasMobileButtonReleased',
            blockType: BlockType.BOOLEAN,
            text: '手机按钮 ID [ID] 刚松开？',
            arguments: {ID: {type: ArgumentType.STRING, defaultValue: 'Z'}},
            disableMonitor: false
          },
          {
            opcode: 'getMobileButtonCount',
            blockType: BlockType.REPORTER,
            text: '手机按钮数量',
            disableMonitor: false
          },
          {
            opcode: 'getLastMobileButtonId',
            blockType: BlockType.REPORTER,
            text: '最后操作的手机按钮 ID',
            disableMonitor: true
          },
          {
            opcode: 'getInputBackend',
            blockType: BlockType.REPORTER,
            text: '灵魂输入后端',
            disableMonitor: true
          },
          {
            opcode: 'getPerformanceDiagnostic',
            blockType: BlockType.REPORTER,
            text: '扩展性能诊断',
            disableMonitor: true
          },
          {
            opcode: 'resetPerformanceStats',
            blockType: BlockType.COMMAND,
            text: '重置性能统计'
          },
          {
            opcode: 'getVersion',
            blockType: BlockType.REPORTER,
            text: 'UT战斗框版本',
            disableMonitor: true
          }
        ],
        menus: {
          AREA_ROLE_MENU: {
            acceptReporters: true,
            items: [
              {text: '主框/基础', value: 'base'},
              {text: '加框', value: 'add'},
              {text: '减框', value: 'subtract'}
            ]
          },
          RESPONSE_MENU: {
            acceptReporters: true,
            items: [
              {text: '触发器', value: 'trigger'},
              {text: '实体', value: 'solid'},
              {text: '实体并触发', value: 'both'}
            ]
          },
          LAYER_MENU: {
            acceptReporters: true,
            items: [
              {text: '子弹', value: 'bullet'},
              {text: '激光', value: 'laser'},
              {text: '安全', value: 'safe'}
            ]
          },
          SOUL_MODE_MENU: {
            acceptReporters: true,
            items: [
              {text: '红魂', value: 'red'},
              {text: '蓝魂', value: 'blue'}
            ]
          },
          MOVEMENT_ALGORITHM_MENU: {
            acceptReporters: true,
            items: [
              {text: '精确', value: 'precise'},
              {text: '快速', value: 'fast'}
            ]
          },
          PERFORMANCE_MODE_MENU: {
            acceptReporters: true,
            items: [
              {text: '自动调节（推荐）', value: 'auto'},
              {text: '高画质', value: 'quality'},
              {text: '均衡', value: 'balanced'},
              {text: '高性能', value: 'performance'},
              {text: '极限省电', value: 'battery'}
            ]
          },
          CAMERA_SOUL_VISUAL_MENU: {
            acceptReporters: true,
            items: [
              {text: '分数倍率像素锁定（推荐）', value: 'pixel'},
              {text: '平滑插值', value: 'smooth'}
            ]
          },
          GRAVITY_MENU: {
            acceptReporters: true,
            items: [
              {text: '向下', value: 'down'},
              {text: '向上', value: 'up'},
              {text: '向左', value: 'left'},
              {text: '向右', value: 'right'}
            ]
          },
          ON_OFF_MENU: {
            acceptReporters: true,
            items: [
              {text: '开启', value: 'on'},
              {text: '关闭', value: 'off'}
            ]
          },
          RENDER_LAYER_MENU: {
            acceptReporters: true,
            items: [
              {text: '精灵后方（推荐）', value: 'behind'},
              {text: '精灵前方', value: 'front'}
            ]
          },
          JOYSTICK_CURVE_MENU: {
            acceptReporters: true,
            items: [
              {text: '线性', value: 'linear'},
              {text: '二次（精细）', value: 'quadratic'},
              {text: '三次（更精细）', value: 'cubic'}
            ]
          },
          ANTIALIAS_QUALITY_MENU: {
            acceptReporters: true,
            items: [
              {text: '自动（跟随摄像机）', value: 'auto'},
              {text: '性能（1×）', value: 'performance'},
              {text: '高清（2×）', value: 'high'},
              {text: '超清（4×）', value: 'ultra'}
            ]
          },
          BACKGROUND_MATERIAL_MENU: {
            acceptReporters: true,
            items: [
              {text: '纯色', value: 'solid'},
              {text: '高斯模糊', value: 'gaussian'},
              {text: '毛玻璃', value: 'glass'}
            ]
          },
          EASING_CURVE_MENU: {
            acceptReporters: true,
            items: [
              {text: '线性', value: 'linear'},
              {text: '平滑步', value: 'smoothstep'},
              {text: '更平滑步', value: 'smootherstep'},
              {text: '二次', value: 'quad'},
              {text: '三次', value: 'cubic'},
              {text: '四次', value: 'quart'},
              {text: '五次', value: 'quint'},
              {text: '正弦', value: 'sine'},
              {text: '指数', value: 'expo'},
              {text: '圆形', value: 'circ'},
              {text: '回退', value: 'back'},
              {text: '弹性', value: 'elastic'},
              {text: '弹跳', value: 'bounce'},
              {text: '柔和弹簧', value: 'springSoft'},
              {text: '标准弹簧', value: 'spring'},
              {text: '强烈弹簧', value: 'springStrong'}
            ]
          },
          EASING_DIRECTION_MENU: {
            acceptReporters: true,
            items: [
              {text: '缓入', value: 'in'},
              {text: '缓出', value: 'out'},
              {text: '缓出入', value: 'inOut'}
            ]
          },
          TWEEN_CONFLICT_MENU: {
            acceptReporters: true,
            items: [
              {text: '替换当前', value: 'replace'},
              {text: '排队', value: 'queue'},
              {text: '忽略新过渡', value: 'ignore'}
            ]
          },
          BOX_EFFECT_MENU: {
            acceptReporters: true,
            items: [
              {text: '抖动', value: 'shake'},
              {text: '呼吸', value: 'breathe'},
              {text: '脉冲', value: 'pulse'},
              {text: '摆动', value: 'swing'},
              {text: '波浪', value: 'wave'},
              {text: '漂浮', value: 'float'}
            ]
          },
          BOX_EFFECT_MODE_MENU: {
            acceptReporters: true,
            items: [
              {text: '仅视觉（推荐）', value: 'visual'},
              {text: '影响物理', value: 'physics'}
            ]
          },
          TWEEN_PROPERTY_MENU: {
            acceptReporters: true,
            items: [
              {text: '中心 x', value: 'x'},
              {text: '中心 y', value: 'y'},
              {text: '宽', value: 'width'},
              {text: '高', value: 'height'},
              {text: '圆角', value: 'roundness'},
              {text: '旋转', value: 'rotation'}
            ]
          }
        }
      };
      info.blocks = organizePaletteBlocks(info.blocks);
      return info;
    }

    _setError(error) {
      const message = error && error.message ? error.message : Cast.toString(error);
      this.lastError = message || '未知错误';
      this.lastStatus = `错误：${this.lastError}`;
      console.error('[UTBattleBox V21]', error);
    }

    _safeCommand(callback) {
      try {
        callback();
        this.lastError = '';
      } catch (error) {
        this._setError(error);
      }
      // 命令积木始终同步结束；持续运行由独立 RAF 循环承担。
      if (this.visualizer) this.visualizer.markDirty();
      this._requestFrame();
    }

    _clearKeys() {
      const keys = this._keys;
      for (const key in keys) delete keys[key];
      this.jumpBuffered = false;
      this._mobileJumpIntentWasDown = false;
    }

    _normalizeKeyCode(event) {
      if (!event) return '';
      if (event.code) return event.code;
      const key = Cast.toString(event.key || '').toLowerCase();
      const map = {
        'arrowleft': 'ArrowLeft', 'left': 'ArrowLeft',
        'arrowright': 'ArrowRight', 'right': 'ArrowRight',
        'arrowup': 'ArrowUp', 'up': 'ArrowUp',
        'arrowdown': 'ArrowDown', 'down': 'ArrowDown',
        'a': 'KeyA', 'd': 'KeyD', 'w': 'KeyW', 's': 'KeyS',
        'z': 'KeyZ', 'x': 'KeyX', 'c': 'KeyC',
        ' ': 'Space', 'space': 'Space', 'spacebar': 'Space'
      };
      return map[key] || '';
    }

    _isControlCode(code) {
      return code === 'ArrowLeft' || code === 'ArrowRight' ||
        code === 'ArrowUp' || code === 'ArrowDown' ||
        code === 'KeyA' || code === 'KeyD' || code === 'KeyW' ||
        code === 'KeyS';
    }

    _isJumpDirectionCode(code) {
      const direction = this.gravity ? this.gravity.direction : 'down';
      if (direction === 'up') return code === 'ArrowDown' || code === 'KeyS';
      if (direction === 'left') return code === 'ArrowRight' || code === 'KeyD';
      if (direction === 'right') return code === 'ArrowLeft' || code === 'KeyA';
      return code === 'ArrowUp' || code === 'KeyW';
    }

    _onKeyDown(event) {
      const code = this._normalizeKeyCode(event);
      if (!code) return;
      const wasDown = Boolean(this._keys[code]);
      this._keys[code] = true;
      if (!wasDown && this.soul.mode === 'blue' && this._isJumpDirectionCode(code)) {
        this.jumpBuffered = true;
      }
      if (this.keyboardEnabled && this.running && this._isControlCode(code) && event && event.preventDefault) {
        event.preventDefault();
      }
      this._requestFrame();
    }

    _onKeyUp(event) {
      const code = this._normalizeKeyCode(event);
      if (!code) return;
      delete this._keys[code];
      if (this.keyboardEnabled && this.running && this._isControlCode(code) && event && event.preventDefault) {
        event.preventDefault();
      }
    }

    _onBlur() {
      if (globalEnv.document && !globalEnv.document.hidden && globalEnv.document.hasFocus && globalEnv.document.hasFocus()) return;
      this._clearKeys();
      if (this.mobileJoystick) this.mobileJoystick.reset();
    }

    _runtimeKeyboardDown(names) {
      if (!runtime || !runtime.ioDevices || !runtime.ioDevices.keyboard) return false;
      const keyboard = runtime.ioDevices.keyboard;
      if (typeof keyboard.getKeyIsDown !== 'function') return false;
      for (let i = 0; i < names.length; i++) {
        try {
          if (keyboard.getKeyIsDown(names[i])) return true;
        } catch (_) {}
      }
      return false;
    }

    _getInput() {
      let x = clamp(this.manualInputX, -1, 1);
      let y = clamp(this.manualInputY, -1, 1);
      let jump = Boolean(this.manualJumpDown || this.jumpBuffered);

      if (this.keyboardEnabled) {
        const left = Boolean(this._keys.ArrowLeft || this._keys.KeyA) ||
          this._runtimeKeyboardDown(['left arrow', 'ArrowLeft', 'a']);
        const right = Boolean(this._keys.ArrowRight || this._keys.KeyD) ||
          this._runtimeKeyboardDown(['right arrow', 'ArrowRight', 'd']);
        const up = Boolean(this._keys.ArrowUp || this._keys.KeyW) ||
          this._runtimeKeyboardDown(['up arrow', 'ArrowUp', 'w']);
        const down = Boolean(this._keys.ArrowDown || this._keys.KeyS) ||
          this._runtimeKeyboardDown(['down arrow', 'ArrowDown', 's']);
        x += (right ? 1 : 0) - (left ? 1 : 0);
        y += (up ? 1 : 0) - (down ? 1 : 0);
      }

      if (this.mobileJoystick) {
        const joystickInput = this.mobileJoystick.getInput();
        x += joystickInput.x;
        y += joystickInput.y;
        // 仅保留旧版隐藏 JUMP 按钮兼容。Z/X/C 不参与跳跃。
        jump = jump || joystickInput.jump;
      }

      const lengthSq = x * x + y * y;
      if (lengthSq > 1) {
        const inverse = 1 / Math.sqrt(lengthSq);
        x *= inverse;
        y *= inverse;
      }

      // Undertale 蓝魂：按重力反方向跳跃。默认向下重力时就是 W / ↑ / 摇杆向上。
      if (this.soul.mode === 'blue' && this.gravity) {
        const jumpIntent =
          x * this.gravity.normal.x +
          y * this.gravity.normal.y;
        jump = jump || jumpIntent >= 0.55;
      }

      return {
        x: clamp(x, -1, 1),
        y: clamp(y, -1, 1),
        jump: Boolean(jump)
      };
    }

    _onMobileInputChanged() {
      if (this.mobileJoystick && this.soul.mode === 'blue' && this.gravity) {
        const input = this.mobileJoystick.getInput();
        const intent = input.x * this.gravity.normal.x + input.y * this.gravity.normal.y;
        const down = intent >= 0.55;
        if (down && !this._mobileJumpIntentWasDown) this.jumpBuffered = true;
        this._mobileJumpIntentWasDown = down;
      } else {
        this._mobileJumpIntentWasDown = false;
      }
      this._requestFrame();
    }

    _onMobileButtonEvent(idValue, eventType) {
      const id = Cast.toString(idValue || '').trim();
      if (!id) return;
      this.lastMobileButtonId = id;
      if (id.toLowerCase() === 'jump' && eventType === 'pressed') {
        this.jumpBuffered = true;
      }
      if (runtime && typeof runtime.startHats === 'function') {
        const opcode = eventType === 'released'
          ? `${EXTENSION_ID}_whenMobileButtonReleased`
          : `${EXTENSION_ID}_whenMobileButtonPressed`;
        runtime.startHats(opcode, {ID: id});
      }
      this._requestFrame();
    }

    _onBoxTweenCompleted(idValue) {
      const id = safeId(idValue);
      this.lastCompletedTweenId = id;
      if (runtime && typeof runtime.startHats === 'function') {
        runtime.startHats(`${EXTENSION_ID}_whenBoxTweenCompleted`, {ID: id});
      }
    }

    _onBoxEffectCompleted(idValue) {
      const id = Cast.toString(idValue || '全部框');
      this.lastCompletedEffectId = id;
      if (runtime && typeof runtime.startHats === 'function') {
        runtime.startHats(`${EXTENSION_ID}_whenBoxEffectCompleted`, {ID: id});
      }
    }

    _beforeFixedStep(deltaSeconds) {
      if (this.tweenSystem && this.tweenSystem.update(deltaSeconds)) {
        this.lastStatus = '框体过渡中';
      }
      if (this.effectSystem) this.effectSystem.applyPhysicalEffects();
    }

    _advanceIdleTweens(nowMs) {
      if (!this.tweenSystem || !this.tweenSystem.hasActiveTweens() || this.running) {
        this._idleTweenLastTime = -1;
        this._idleTweenAccumulator = 0;
        // Box effects have an independent wall-clock. Resetting _effectLastTime here
        // caused every visual effect frame to restart at t=0 whenever no idle tween
        // was active, so the effect only appeared to move when another UI redraw occurred.
        return;
      }
      if (!Number.isFinite(this._idleTweenLastTime) || this._idleTweenLastTime < 0) {
        this._idleTweenLastTime = nowMs;
        return;
      }
      let frameTime = (nowMs - this._idleTweenLastTime) / 1000;
      this._idleTweenLastTime = nowMs;
      if (!Number.isFinite(frameTime) || frameTime < 0) frameTime = 0;
      this._idleTweenAccumulator += Math.min(0.25, frameTime);
      let steps = 0;
      while (this._idleTweenAccumulator >= FIXED_DT && steps < 8) {
        this.tweenSystem.update(FIXED_DT);
        this._idleTweenAccumulator -= FIXED_DT;
        steps++;
      }
      if (steps >= 8 && this._idleTweenAccumulator >= FIXED_DT) {
        this._idleTweenAccumulator = 0;
      }
    }

    _afterFixedStep(soul, deltaSeconds, updated = true) {
      try {
        if (updated) {
          AttackSystem.testSoulPathSampled(
            soul,
            this.manager.triggerHitboxes,
            (hitbox) => {
              const damage = Number.isFinite(hitbox.damage) ? Math.max(0, hitbox.damage) : 0;
              this.lastHitId = Cast.toString(hitbox.id);
              this.lastHitDamage = damage;
              this.health = Math.max(0, this.health - damage);
              if (runtime && typeof runtime.startHats === 'function') {
                runtime.startHats(`${EXTENSION_ID}_whenSoulHit`);
              }
            }
          );
        }
      } finally {
        if (this.effectSystem) this.effectSystem.restorePhysicalEffects();
      }
    }

    _releaseCameraSoulSampling() {
      if (this._cameraSoulSamplingBinding) {
        removeSoulPixelSampling(this._cameraSoulSamplingBinding);
        this._cameraSoulSamplingBinding = null;
      }
    }

    _syncCameraSoulSampling(drawable) {
      if (this.cameraSoulVisualMode !== 'pixel' || !drawable || !drawable.skin) {
        this._releaseCameraSoulSampling();
        return false;
      }
      if (
        this._cameraSoulSamplingBinding &&
        this._cameraSoulSamplingBinding.skin === drawable.skin &&
        this._cameraSoulSamplingBinding.drawableId === drawable._id
      ) return true;
      this._releaseCameraSoulSampling();
      this._cameraSoulSamplingBinding = installSoulPixelSampling(drawable);
      return Boolean(this._cameraSoulSamplingBinding);
    }

    _observeCameraSoulScale(target, drawable, cameraState) {
      if (!target || !drawable || !cameraState) return false;
      const zoom = Math.abs(Number(cameraState.ogSZ));
      const logicalSize = Math.abs(Number(target.size));
      const scale = readDrawableScale(drawable);
      if (!Number.isFinite(zoom) || !Number.isFinite(logicalSize) || !scale) {
        this._cameraSoulScaleStatus = '无法读取 Camera V2 缩放诊断数据';
        return false;
      }
      const expected = logicalSize * zoom;
      const actualX = Math.abs(Number(scale[0]));
      const actualY = Math.abs(Number(scale[1]));
      const tolerance = Math.max(0.25, expected * 0.004);
      const mismatch = Math.abs(actualX - expected) > tolerance || Math.abs(actualY - expected) > tolerance;
      this._cameraSoulLastZoom = zoom;
      this._cameraSoulScaleStatus = mismatch
        ? `Drawable 倍率仅诊断：实际 ${actualX.toFixed(2)}×${actualY.toFixed(2)}，期望 ${expected.toFixed(2)}；UTBattleBox 不写缩放`
        : `Drawable ${actualX.toFixed(2)}×${actualY.toFixed(2)}，期望 ${expected.toFixed(2)}，缩放正常`;
      return mismatch;
    }

    _stabilizeBoundTargetCameraScale(target) {
      // Compatibility entry point only. Camera V2 exclusively owns scale.
      return false;
    }

    _submitSoulDisplayPosition(renderer, drawableId, worldX, worldY) {
      if (!renderer || !Number.isFinite(drawableId) || typeof renderer.updateDrawablePosition !== 'function') return false;
      if (
        this._lastSoulDisplayDrawableId === drawableId &&
        Math.abs(this._lastSoulDisplayWorldX - worldX) < 1e-7 &&
        Math.abs(this._lastSoulDisplayWorldY - worldY) < 1e-7
      ) return false;
      renderer.updateDrawablePosition(drawableId, [worldX, worldY]);
      this._lastSoulDisplayDrawableId = drawableId;
      this._lastSoulDisplayWorldX = worldX;
      this._lastSoulDisplayWorldY = worldY;
      return true;
    }

    _syncBoundTarget(forceExact = false) {
      const target = this.boundTarget;
      if (!target || target.isStage || typeof target.setXY !== 'function') return;
      if (runtime && Array.isArray(runtime.targets) && runtime.targets.indexOf(target) < 0) {
        this._releaseCameraSoulSampling();
        this.boundTarget = null;
        return;
      }

      const exactX = this.soul.x;
      const exactY = this.soul.y;
      if (!Number.isFinite(exactX) || !Number.isFinite(exactY)) return;

      let renderX = exactX;
      let renderY = exactY;
      if (
        this.visualInterpolationEnabled && !forceExact && this.running &&
        !this.soul.teleportedThisStep && !this.soul.recoveryFailedThisStep &&
        this.clock && typeof this.clock.getAlpha === 'function'
      ) {
        const alpha = clamp(this.clock.getAlpha(), 0, 1);
        renderX = this.soul.previousX + (exactX - this.soul.previousX) * alpha;
        renderY = this.soul.previousY + (exactY - this.soul.previousY) * alpha;
      }

      const renderer = vm && vm.renderer;
      const drawableId = target.drawableID;
      const drawable = renderer && Number.isFinite(drawableId) && renderer._allDrawables
        ? renderer._allDrawables[drawableId]
        : null;
      const cameraState = drawable ? findCameraV2State(drawable) : null;

      this._cameraScaleGuardInstalled = false;
      this._lastDirectCameraSoulTransform = false;
      this._cameraExclusiveTargetSync = Boolean(cameraState);

      // Always keep the Scratch target at the exact physical world position.
      // This is the only logical state written by the battle-box extension.
      const exactSameX = Number.isFinite(target.x) && Math.abs(target.x - exactX) < 0.00001;
      const exactSameY = Number.isFinite(target.y) && Math.abs(target.y - exactY) < 0.00001;
      if (!exactSameX || !exactSameY) target.setXY(exactX, exactY, true);

      if (cameraState) {
        const pixelStable = this.cameraSoulVisualMode === 'pixel';
        this._syncCameraSoulSampling(drawable);
        this._observeCameraSoulScale(target, drawable, cameraState);

        if (pixelStable) {
          // Keep physics coordinates exact, but align the DISPLAYED center to the real
          // framebuffer pixel grid. This removes the one-pixel width/height alternation
          // seen mainly between 100% and 200% Camera V2 zoom. No scale or direction API
          // is called: Camera V2 remains the sole transform owner.
          const snapped = snapCameraV2WorldPosition(renderer, cameraState, exactX, exactY);
          if (snapped && renderer && typeof renderer.updateDrawablePosition === 'function') {
            const deltaX = Math.abs(snapped.worldX - exactX);
            const deltaY = Math.abs(snapped.worldY - exactY);
            if (deltaX > 0.0000001 || deltaY > 0.0000001) {
              this._submitSoulDisplayPosition(renderer, drawableId, snapped.worldX, snapped.worldY);
            }
            this._cameraSoulScaleStatus += `；屏幕中心锁定 (${snapped.screenX.toFixed(3)}, ${snapped.screenY.toFixed(3)})，像素密度 ${snapped.ratioX.toFixed(2)}×${snapped.ratioY.toFixed(2)}`;
          }
          return;
        }

        // Smooth mode is optional. It submits only a temporary WORLD position through
        // Camera V2's own updatePosition wrapper and never touches scale/direction.
        if (
          !forceExact &&
          (Math.abs(renderX - exactX) > 0.00001 || Math.abs(renderY - exactY) > 0.00001) &&
          renderer && typeof renderer.updateDrawablePosition === 'function'
        ) {
          this._submitSoulDisplayPosition(renderer, drawableId, renderX, renderY);
        }
        return;
      }

      this._releaseCameraSoulSampling();

      // Non-camera renderers can still receive a direct interpolated position. This
      // changes position only and leaves the sprite's direction/scale untouched.
      if (
        !forceExact &&
        (Math.abs(renderX - exactX) > 0.00001 || Math.abs(renderY - exactY) > 0.00001) &&
        renderer && Number.isFinite(drawableId) &&
        typeof renderer.updateDrawablePosition === 'function'
      ) {
        renderer.updateDrawablePosition(drawableId, [renderX, renderY]);
      }
    }

    _runOneFixedStep(input) {
      this._beforeFixedStep(FIXED_DT);
      const updated = this.controller.fixedUpdate(
        this.soul,
        input.x,
        input.y,
        input.jump,
        this.manager.areaWorld,
        this.manager.solidHitboxes
      );
      this._afterFixedStep(this.soul, FIXED_DT, updated);
      return updated;
    }

    _advanceBoxEffects(nowMs) {
      if (!this.effectSystem || !this.effectSystem.hasActiveEffects()) {
        this._effectLastTime = -1;
        return false;
      }
      if (!Number.isFinite(this._effectLastTime) || this._effectLastTime < 0) {
        this._effectLastTime = nowMs;
        return false;
      }
      let deltaSeconds = (nowMs - this._effectLastTime) / 1000;
      this._effectLastTime = nowMs;
      if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) deltaSeconds = 0;
      const changed = this.effectSystem.update(Math.min(0.25, deltaSeconds));
      if (changed && this.visualizer) this.visualizer.markDirty();
      return changed;
    }

    _needsAnotherFrame() {
      return Boolean(
        this.running ||
        (this.tweenSystem && this.tweenSystem.hasActiveTweens() && !this.tweenSystem.paused) ||
        (this.effectSystem && this.effectSystem.hasActiveEffects() && !this.effectSystem.paused) ||
        (this.visualizer && this.visualizer.needsContinuousFrames())
      );
    }

    _ensureRafWatchdog() {
      if (this._rafWatchdogHandle !== null || typeof globalEnv.setTimeout !== 'function') return;
      this._rafWatchdogHandle = globalEnv.setTimeout(() => {
        this._rafWatchdogHandle = null;
        const now = getNowMs();
        if (this._animationFrameHandle !== null && now - this._frameRequestStartedAt > 90) {
          if (typeof globalEnv.cancelAnimationFrame === 'function') {
            try { globalEnv.cancelAnimationFrame(this._animationFrameHandle); } catch (error) {}
          }
          this._animationFrameHandle = null;
          this._lastFrameDriverKind = 'rAF 看门狗回退';
          this._animationFrame(now);
          return;
        }
        if (this._needsAnotherFrame() || this._animationFrameHandle !== null) this._ensureRafWatchdog();
      }, 120);
    }

    _requestFrame() {
      if (this._animationFrameHandle !== null || this._animationFrameTimeoutHandle !== null) return;
      const schedulerDelay = this._getSchedulerDelayMs();
      const token = ++this._animationFrameToken;
      if (schedulerDelay <= 24 && typeof globalEnv.requestAnimationFrame === 'function') {
        this._frameRequestStartedAt = getNowMs();
        try {
          this._animationFrameHandle = globalEnv.requestAnimationFrame(nowMs => {
            if (token !== this._animationFrameToken) return;
            this._animationFrameHandle = null;
            this._lastFrameDriverKind = 'requestAnimationFrame';
            this._animationFrame(nowMs);
          });
          this._ensureRafWatchdog();
          return;
        } catch (error) {
          this._animationFrameHandle = null;
        }
      }
      const setTimer = typeof globalEnv.setTimeout === 'function'
        ? globalEnv.setTimeout.bind(globalEnv)
        : setTimeout;
      this._animationFrameTimeoutHandle = setTimer(() => {
        if (token !== this._animationFrameToken) return;
        this._animationFrameTimeoutHandle = null;
        this._lastFrameDriverKind = '定时器调度';
        this._animationFrame(getNowMs());
      }, Math.max(16, schedulerDelay));
    }

    _animationFrame(nowMs) {
      this._animationFrameHandle = null;
      this._animationFrameTimeoutHandle = null;
      const frameStart = getNowMs();
      const safeNow = Number.isFinite(nowMs) ? nowMs : frameStart;
      this._advanceIdleTweens(safeNow);
      this._advanceBoxEffects(safeNow);
      this._runtimeStep(safeNow);

      if (this.visualizer) {
        this.visualizer.setAnimationActivity(
          Boolean(this.tweenSystem && this.tweenSystem.hasActiveTweens() && !this.tweenSystem.paused),
          Boolean(this.effectSystem && this.effectSystem.hasActiveEffects() && !this.effectSystem.paused)
        );
        const immediate = this.visualizer.hasImmediateWork(safeNow);
        const pacing = this._getVisualPacingDecision(safeNow, immediate);
        if (pacing.due) {
          const rendered = this.visualizer.render(this.soul, false, safeNow);
          this._commitVisualPacing(pacing);
          if (rendered) this._scheduledVisualRenders++;
          else this._scheduledVisualSkips++;
        } else {
          this._scheduledVisualSkips++;
        }
      }

      this._recordPerformanceSample(getNowMs() - frameStart, safeNow);
      if (this._needsAnotherFrame()) this._requestFrame();
    }

    _runtimeStep(nowMs = getNowMs()) {
      if (!this.running) return;
      try {
        // 启动物理允许早于创建框；此时只等待，不阻塞 Scratch 脚本。
        if (!this.manager.areaWorld.root) {
          this.lastStatus = '运行已启动，等待创建主框或加框';
          this._syncBoundTarget();
          return;
        }

        const input = this._getInput();
        const steps = this.clock.tick(
          this.soul,
          input.x,
          input.y,
          input.jump,
          this.manager.areaWorld,
          this.manager.solidHitboxes,
          nowMs
        );
        if (steps > 0) this.jumpBuffered = false;

        this._syncBoundTarget();

        if (this.soul.recoveryFailedThisStep) {
          this.lastStatus = '物理恢复失败：请检查出生点、主框和减框';
          if (!this._recoveryHatWasActive && runtime && typeof runtime.startHats === 'function') {
            runtime.startHats(`${EXTENSION_ID}_whenRecoveryFailed`);
          }
          this._recoveryHatWasActive = true;
        } else {
          this._recoveryHatWasActive = false;
          this.lastStatus = '运行中';
        }
      } catch (error) {
        this.running = false;
        this.clock.reset();
        this._setError(error);
      }
    }

    resetSystem() {
      this._safeCommand(() => {
        this.running = false;
        if (this.visualizer) {
          this.visualizer.restoreAllTargetReplacements();
          this.visualizer.restoreAllTargetInteriorClips();
        }
        if (this.tweenSystem) this.tweenSystem.clear();
        if (this.effectSystem) this.effectSystem.clear();
        this.manager.clear();
        this.gravity.setDirection('down');
        this.soul = new Soul();
        this.controller = new SoulController(this.gravity);
        this.clock = new PhysicsClock(this.controller);
        this.clock.beforeFixedStep = this._beforeFixedStep.bind(this);
        this.clock.afterFixedStep = this._afterFixedStep.bind(this);
        if (this.visualizer) this.visualizer.markDirty();
        this._releaseCameraSoulSampling();
        this.boundTarget = null;
        this._cameraSoulLastZoom = NaN;
        this._cameraSoulZoomChangedAt = -1;
        this._cameraSoulScaleStatus = '等待绑定灵魂';
        this._lastSoulDisplayDrawableId = null;
        this._lastSoulDisplayWorldX = NaN;
        this._lastSoulDisplayWorldY = NaN;
        this._resetVisualPacing();
        this.health = 20;
        this.lastHitId = '';
        this.lastHitDamage = 0;
        this.lastCompletedTweenId = '';
        this.lastCompletedEffectId = '';
        this._idleTweenLastTime = -1;
        this._idleTweenAccumulator = 0;
        this._effectLastTime = -1;
        this.manualInputX = 0;
        this.manualInputY = 0;
        this.manualJumpDown = false;
        this.jumpBuffered = false;
        this._mobileJumpIntentWasDown = false;
        this.lastMobileButtonId = '';
        this.visualInterpolationEnabled = true;
        this._lastVisualRenderMs = -Infinity;
        this.resetPerformanceStats();
        this._clearKeys();
        if (this.mobileJoystick) this.mobileJoystick.setEnabled(false);
        this.lastStatus = '系统已重置';
      });
    }

    startPhysics() {
      this._safeCommand(() => {
        this.clock.reset();
        this._idleTweenLastTime = -1;
        this._idleTweenAccumulator = 0;
        this.running = true;
        this.lastStatus = this.manager.areaWorld.root
          ? '运行中'
          : '运行已启动，等待创建主框或加框';
      });
    }

    stopPhysics() {
      this.running = false;
      this.clock.reset();
      this._idleTweenLastTime = -1;
      this._idleTweenAccumulator = 0;
      this._syncBoundTarget(true);
      this.lastStatus = '已暂停';
      this._requestFrame();
    }

    stepPhysicsOnce() {
      this._safeCommand(() => {
        if (!this.manager.areaWorld.root) throw new Error('请先创建战斗区域。');
        const input = this._getInput();
        const updated = this._runOneFixedStep(input);
        this.jumpBuffered = false;
        this._syncBoundTarget(true);
        this.lastStatus = updated ? '已执行一次物理步' : '物理步失败';
      });
    }

    bindCurrentSprite(args, util) {
      this._safeCommand(() => {
        const target = util && util.target;
        if (!target || target.isStage || typeof target.setXY !== 'function') {
          throw new Error('该积木必须由角色执行，不能由舞台执行。');
        }
        if (this.boundTarget !== target) this._releaseCameraSoulSampling();
        this.boundTarget = target;
        this._lastSoulDisplayDrawableId = null;
        this._lastSoulDisplayWorldX = NaN;
        this._lastSoulDisplayWorldY = NaN;
        this._cameraSoulLastZoom = NaN;
        this._cameraSoulZoomChangedAt = -1;
        const x = Number.isFinite(target.x) ? target.x : 0;
        const y = Number.isFinite(target.y) ? target.y : 0;
        const legal = this.manager.isCircleLegal(x, y, this.soul.radius);
        this.soul.setPosition(x, y, legal, false);
        this.clock.reset();
        this.lastStatus = legal ? '已绑定当前角色' : '已绑定，但角色当前位置不合法';
      });
    }

    unbindSprite() {
      this._releaseCameraSoulSampling();
      this.boundTarget = null;
      this._lastSoulDisplayDrawableId = null;
      this._lastSoulDisplayWorldX = NaN;
      this._lastSoulDisplayWorldY = NaN;
      this._cameraSoulLastZoom = NaN;
      this._cameraSoulScaleStatus = '等待绑定灵魂';
      this.lastStatus = '已解除角色绑定';
      this._requestFrame();
    }

    setKeyboardEnabled(args) {
      this.keyboardEnabled = parseOnOff(args.STATE);
      if (!this.keyboardEnabled) this._clearKeys();
      this.lastStatus = this.keyboardEnabled ? '键盘控制已开启' : '键盘控制已关闭';
      this._requestFrame();
    }

    setVisualInterpolation(args) {
      this.visualInterpolationEnabled = parseOnOff(args.STATE);
      if (!this.visualInterpolationEnabled) this._syncBoundTarget(true);
      this.lastStatus = this.visualInterpolationEnabled ? '灵魂显示平滑插值已开启' : '灵魂显示平滑插值已关闭';
      this._requestFrame();
    }

    setCameraSoulVisualMode(args) {
      const requested = Cast.toString(args.MODE || '').trim().toLowerCase();
      this.cameraSoulVisualMode = requested === 'smooth' || requested === '平滑插值'
        ? 'smooth'
        : 'pixel';
      if (this.cameraSoulVisualMode !== 'pixel') this._releaseCameraSoulSampling();
      this._cameraSoulLastZoom = NaN;
      this._cameraSoulZoomChangedAt = -1;
      this.lastStatus = this.cameraSoulVisualMode === 'pixel'
        ? '摄像机灵魂显示：分数倍率像素锁定'
        : '摄像机灵魂显示：平滑插值';
      this._syncBoundTarget(true);
      this._requestFrame();
    }

    setSoulMovementAlgorithm(args) {
      const requested = Cast.toString(args.ALGORITHM || '').trim().toLowerCase();
      const mode = requested === 'fast' || requested === '快速' ? 'fast' : 'precise';
      if (this.controller && typeof this.controller.setMovementAlgorithm === 'function') {
        this.controller.setMovementAlgorithm(mode);
      } else if (this.controller) {
        this.controller.movementAlgorithm = mode;
      }

      // 老设备最容易出现的是掉帧后一次补算很多物理步造成的 CPU 峰值。
      // 快速模式限制追帧数量；精确模式恢复原来的最多 8 步。
      if (this.clock) {
        this.clock.maxStepsPerFrame = mode === 'fast' ? 3 : 8;
        this.clock.reset();
      }

      this.lastStatus = mode === 'fast'
        ? '灵魂移动算法：快速（低开销，可能穿过极细或高速障碍）'
        : '灵魂移动算法：精确（自适应子步）';
      this._requestFrame();
    }

    setPerformanceMode(args) {
      this.performanceMode = normalizePerformanceMode(args.MODE);
      if (this.performanceMode !== PerformanceMode.AUTO) {
        this._autoPerformanceLevel = 0;
        this._autoSlowScore = 0;
        this._autoFastScore = 0;
      }
      if (this.visualizer) this.visualizer.setPerformanceMode(this.performanceMode, this._autoPerformanceLevel);
      this.lastStatus = `扩展性能模式：${performanceModeName(this.performanceMode, this._autoPerformanceLevel)}`;
      this._resetVisualPacing();
      this._requestFrame();
    }

    setRenderFpsLimit(args) {
      this.renderFpsLimit = clamp(Math.round(finiteNumber(args.FPS, 60)), 10, 60);
      this.lastStatus = `战斗框最大渲染帧率：${this.renderFpsLimit} FPS`;
      this._resetVisualPacing();
      this._requestFrame();
    }

    _getEffectiveRenderFps() {
      const config = this.visualizer
        ? this.visualizer._getPerformanceConfig()
        : PERFORMANCE_CONFIGS.balanced;
      return Math.max(10, Math.min(this.renderFpsLimit, config.renderFps));
    }

    _resetVisualPacing(nowMs = NaN) {
      this._lastVisualRenderMs = -Infinity;
      this._nextVisualRenderMs = Number.isFinite(nowMs) ? nowMs : -Infinity;
      this._visualPacingFps = 0;
      this._visualDeadlineResets++;
    }

    _getVisualPacingDecision(nowMs, immediate = false) {
      const now = Number.isFinite(nowMs) ? nowMs : getNowMs();
      const fps = this._getEffectiveRenderFps();
      const interval = 1000 / Math.max(1, fps);
      // A small tolerance is essential for integer millisecond rAF timestamps. Without
      // it, 16 ms is considered too early for a 16.667 ms deadline and 60 FPS collapses
      // to every other frame.
      const tolerance = fps >= 55 ? 1.75 : Math.min(2.25, interval * 0.12);
      if (this._visualPacingFps !== fps || !Number.isFinite(this._nextVisualRenderMs)) {
        this._visualPacingFps = fps;
        this._nextVisualRenderMs = now;
      }
      return {
        now,
        fps,
        interval,
        tolerance,
        immediate: Boolean(immediate),
        due: Boolean(immediate || now + tolerance >= this._nextVisualRenderMs)
      };
    }

    _commitVisualPacing(decision) {
      if (!decision) return;
      const now = decision.now;
      const interval = decision.interval;
      const tolerance = decision.tolerance;
      if (
        decision.immediate ||
        !Number.isFinite(this._nextVisualRenderMs) ||
        this._nextVisualRenderMs < now - interval * 4
      ) {
        this._nextVisualRenderMs = now + interval;
      } else {
        do {
          this._nextVisualRenderMs += interval;
        } while (this._nextVisualRenderMs <= now + tolerance);
      }
      this._lastVisualRenderMs = now;
    }

    _recordPerformanceSample(frameCostMs, nowMs) {
      const cost = Math.max(0, finiteNumber(frameCostMs, 0));
      const now = Number.isFinite(nowMs) ? nowMs : getNowMs();
      if (this._frameCostEma <= 0) this._frameCostEma = cost;
      else this._frameCostEma += (cost - this._frameCostEma) * 0.08;
      if (this._lastAnimationNow >= 0) {
        const interval = Math.max(0, now - this._lastAnimationNow);
        if (this._frameIntervalEma <= 0) this._frameIntervalEma = interval;
        else this._frameIntervalEma += (interval - this._frameIntervalEma) * 0.05;
      }
      this._lastAnimationNow = now;

      if (this.performanceMode !== PerformanceMode.AUTO) return;
      const latencySensitive = Boolean(
        this.running ||
        (this.tweenSystem && this.tweenSystem.hasActiveTweens() && !this.tweenSystem.paused) ||
        (this.effectSystem && this.effectSystem.hasActiveEffects() && !this.effectSystem.paused)
      );
      // Idle camera/clip maintenance intentionally runs at 100～280ms intervals; that is
      // power saving, not a dropped frame. Only treat long frame intervals as overload
      // while physics or animation actually requires low latency.
      const overloaded = this._frameCostEma > 14 ||
        (latencySensitive && this._frameIntervalEma > 25);
      const comfortable = this._frameCostEma > 0 && this._frameCostEma < 6 &&
        (!latencySensitive || (this._frameIntervalEma > 0 && this._frameIntervalEma < 19));
      if (overloaded) {
        this._autoSlowScore++;
        this._autoFastScore = Math.max(0, this._autoFastScore - 4);
      } else if (comfortable) {
        this._autoFastScore++;
        this._autoSlowScore = Math.max(0, this._autoSlowScore - 1);
      } else {
        this._autoSlowScore = Math.max(0, this._autoSlowScore - 1);
        this._autoFastScore = Math.max(0, this._autoFastScore - 1);
      }

      if (this._autoSlowScore >= 18 && this._autoPerformanceLevel < 3) {
        this._autoPerformanceLevel++;
        this._autoSlowScore = 0;
        this._autoFastScore = 0;
        if (this.visualizer) this.visualizer.setAutoPerformanceLevel(this._autoPerformanceLevel);
        this._resetVisualPacing();
      } else if (this._autoFastScore >= 600 && this._autoPerformanceLevel > 0) {
        this._autoPerformanceLevel--;
        this._autoSlowScore = 0;
        this._autoFastScore = 0;
        if (this.visualizer) this.visualizer.setAutoPerformanceLevel(this._autoPerformanceLevel);
        this._resetVisualPacing();
      }
    }

    _getSchedulerDelayMs() {
      const config = this.visualizer
        ? this.visualizer._getPerformanceConfig()
        : PERFORMANCE_CONFIGS.balanced;
      if (this.running ||
          (this.tweenSystem && this.tweenSystem.hasActiveTweens() && !this.tweenSystem.paused)) {
        return 16;
      }
      if (this.effectSystem && this.effectSystem.hasActiveEffects() && !this.effectSystem.paused) {
        const fps = Math.max(5, Math.min(this.effectSystem.refreshRate, this._getEffectiveRenderFps()));
        return Math.max(16, Math.round(1000 / fps));
      }
      if (this.visualizer && this.visualizer.backgroundMaterial !== 'solid') {
        const fps = Math.max(1, Math.min(this.visualizer.materialRefreshHz, config.materialHzCap));
        return Math.max(33, Math.round(1000 / fps));
      }
      return config.idlePollMs;
    }

    getPerformanceDiagnostic() {
      const scheduler = `${performanceModeName(this.performanceMode, this._autoPerformanceLevel)}；` +
        `最大 ${this._getEffectiveRenderFps()} FPS，帧开销 EMA ${this._frameCostEma.toFixed(2)} ms，` +
        `帧间隔 EMA ${this._frameIntervalEma.toFixed(2)} ms，调度绘制 ${this._scheduledVisualRenders}，` +
        `调度跳过 ${this._scheduledVisualSkips}，累计时轴调度`;

      return this.visualizer ? `${scheduler}；${this.visualizer.getPerformanceStatus()}` : scheduler;
    }

    resetPerformanceStats() {
      this._frameCostEma = 0;
      this._frameIntervalEma = 0;
      this._lastAnimationNow = -1;
      this._autoSlowScore = 0;
      this._autoFastScore = 0;
      this._scheduledVisualRenders = 0;
      this._scheduledVisualSkips = 0;
      this._resetVisualPacing();
      if (this.visualizer) this.visualizer.resetPerformanceStats();
      this.lastStatus = '性能统计已重置';
    }

    setJoystickEnabled(args) {
      const enabled = parseOnOff(args.STATE);
      if (!this.mobileJoystick || !this.mobileJoystick.available) {
        this.lastStatus = '当前环境不支持手机摇杆';
        return;
      }
      this.mobileJoystick.setEnabled(enabled);
      this.lastStatus = enabled ? '手机摇杆控制已开启' : '手机摇杆控制已关闭';
      this._requestFrame();
    }

    configureJoystickPosition(args) {
      if (!this.mobileJoystick) return;
      this.mobileJoystick.configurePosition(args.X, args.Y, args.SIZE, args.KNOB);
      this.lastStatus = '手机摇杆位置与尺寸已更新';
      this._requestFrame();
    }

    configureJoystickFeel(args) {
      if (!this.mobileJoystick) return;
      this.mobileJoystick.configureFeel(args.DEADZONE, args.CURVE);
      this.lastStatus = '手机摇杆响应已更新';
    }

    configureJoystickColors(args) {
      if (!this.mobileJoystick) return;
      this.mobileJoystick.configureColors(args.OUTER, args.INNER);
      this.lastStatus = '手机摇杆颜色已更新';
    }

    configureJoystickImages(args) {
      if (!this.mobileJoystick) return;
      this.mobileJoystick.configureImages(args.OUTER, args.INNER);
      this.lastStatus = '手机摇杆图片已更新';
    }

    configureJumpButton(args) {
      if (!this.mobileJoystick) return;
      this.mobileJoystick.configureJump(
        parseOnOff(args.STATE), args.X, args.Y, args.SIZE, args.COLOR, args.TEXT
      );
      this.lastStatus = parseOnOff(args.STATE) ? '旧版 JUMP 兼容按钮已开启' : '旧版 JUMP 兼容按钮已关闭';
    }

    createMobileButton(args) {
      if (!this.mobileJoystick) return;
      const ok = this.mobileJoystick.createOrUpdateButton(
        args.ID, args.X, args.Y, args.SIZE, args.COLOR, args.TEXT
      );
      this.lastStatus = ok ? `手机按钮 ${Cast.toString(args.ID)} 已创建/更新` : '手机按钮 ID 无效';
      this._requestFrame();
    }

    setMobileButtonImage(args) {
      if (!this.mobileJoystick) return;
      const ok = this.mobileJoystick.setButtonImage(args.ID, args.IMAGE);
      this.lastStatus = ok ? '手机按钮图片已更新' : '找不到手机按钮';
      this._requestFrame();
    }

    setMobileButtonVisible(args) {
      if (!this.mobileJoystick) return;
      const ok = this.mobileJoystick.setButtonVisible(args.ID, parseOnOff(args.STATE));
      this.lastStatus = ok ? '手机按钮可见性已更新' : '找不到手机按钮';
      this._requestFrame();
    }

    removeMobileButton(args) {
      if (!this.mobileJoystick) return;
      this.lastStatus = this.mobileJoystick.removeButton(args.ID)
        ? '手机按钮已删除'
        : '找不到手机按钮';
      this._requestFrame();
    }

    removeAllMobileButtons() {
      if (!this.mobileJoystick) return;
      this.mobileJoystick.removeAllButtons();
      this.lastStatus = '所有手机按钮已删除';
      this._requestFrame();
    }

    createDefaultUTButtons() {
      if (!this.mobileJoystick) return;
      this.mobileJoystick.createDefaultButtons();
      this.lastStatus = '默认 Z / X / C 手机按钮已创建';
      this._requestFrame();
    }

    setRenderingEnabled(args) {
      if (this.visualizer) this.visualizer.setEnabled(parseOnOff(args.STATE));
      this.lastStatus = parseOnOff(args.STATE) ? '舞台渲染已开启' : '舞台渲染已关闭';
      this._requestFrame();
    }

    setRenderLayer(args) {
      const layer = Cast.toString(args.LAYER).toLowerCase() === 'front' ? 'front' : 'behind';
      if (this.visualizer) this.visualizer.setLayerMode(layer);
      this.lastStatus = layer === 'front'
        ? '战斗框已置于精灵前方'
        : '战斗框已置于精灵后方';
      this._requestFrame();
    }

    replaceCurrentSpriteWithBox(args, util) {
      this._safeCommand(() => {
        const target = util && util.target;
        if (!target || target.isStage || !Number.isFinite(target.drawableID)) {
          throw new Error('该积木必须由具有 Drawable 的角色或克隆执行。');
        }
        const enabled = parseOnOff(args.STATE);
        if (!this.visualizer || !this.visualizer.setTargetReplacement(target, enabled)) {
          throw new Error('无法切换当前角色的战斗框图层代理。');
        }
        this.lastStatus = enabled
          ? '当前角色已由战斗框图层代理替换'
          : '当前角色的战斗框图层代理已关闭';
      });
    }

    restoreAllReplacedSprites() {
      if (this.visualizer) this.visualizer.restoreAllTargetReplacements();
      this.lastStatus = '已恢复所有被框替换的角色';
      this._requestFrame();
    }

    isCurrentSpriteReplaced(args, util) {
      const target = util && util.target;
      return Boolean(this.visualizer && this.visualizer.isTargetReplaced(target));
    }

    clipCurrentSpriteToInterior(args, util) {
      this._safeCommand(() => {
        const target = util && util.target;
        if (!target || target.isStage || !Number.isFinite(target.drawableID)) {
          throw new Error('该积木必须由具有 Drawable 的角色或克隆执行。');
        }
        const enabled = parseOnOff(args.STATE);
        if (!this.visualizer || !this.visualizer.setTargetInteriorClip(target, enabled)) {
          throw new Error('无法切换当前角色的框内 Stencil 裁剪。');
        }
        this.lastStatus = enabled
          ? '当前角色已限制为仅在战斗框内部显示'
          : '当前角色的框内裁剪已关闭';
        this._requestFrame();
      });
    }

    restoreAllInteriorClippedSprites() {
      if (this.visualizer) this.visualizer.restoreAllTargetInteriorClips();
      this.lastStatus = '已恢复所有框内裁剪角色';
      this._requestFrame();
    }

    isCurrentSpriteInteriorClipped(args, util) {
      const target = util && util.target;
      return Boolean(this.visualizer && this.visualizer.isTargetInteriorClipped(target));
    }

    setRenderStyle(args) {
      if (this.visualizer) {
        this.visualizer.setStyle(
          args.COLOR,
          args.WIDTH,
          clamp(finiteNumber(args.ALPHA, 28) / 100, 0, 1)
        );
      }
      this.lastStatus = '渲染样式已更新';
      this._requestFrame();
    }

    setBattleBoxAntiAliasQuality(args) {
      if (this.visualizer) this.visualizer.setAntiAliasQuality(args.QUALITY);
      this.lastStatus = `战斗框抗锯齿：${this.visualizer ? this.visualizer.getAntiAliasQualityName() : '自动'}`;
      this._requestFrame();
    }

    setAdaptiveCameraRendering(args) {
      if (this.visualizer) {
        this.visualizer.setAdaptiveViewportRendering(
          parseOnOff(args.STATE),
          args.MARGIN,
          args.MAX
        );
      }
      this.lastStatus = this.visualizer
        ? this.visualizer.getAdaptiveViewportStatus()
        : '摄像机自适应渲染器未初始化';
      this._requestFrame();
    }

    setGpuZoomMemoryGuard(args) {
      if (this.visualizer) {
        this.visualizer.setGpuZoomMemoryGuard(
          parseOnOff(args.STATE),
          args.WAIT,
          args.BUDGET
        );
      }
      this.lastStatus = this.visualizer
        ? this.visualizer.getGpuMemoryGuardStatus()
        : '显存保护渲染器未初始化';
      this._requestFrame();
    }

    setBackgroundMaterial(args) {
      if (this.visualizer) this.visualizer.setBackgroundMaterial(args.MATERIAL);
      this.lastStatus = `背景材质已设为 ${this.visualizer ? this.visualizer.getMaterialName() : '纯色'}`;
      this._requestFrame();
    }

    setBlurMaterialSettings(args) {
      if (this.visualizer) this.visualizer.setBlurSettings(args.RADIUS, args.FPS);
      this.lastStatus = '背景模糊参数已更新';
      this._requestFrame();
    }

    setMaterialShade(args) {
      if (this.visualizer) {
        this.visualizer.setMaterialShadeOpacity(
          clamp(finiteNumber(args.ALPHA, 18) / 100, 0, 0.85)
        );
      }
      this.lastStatus = '动态背景暗度已更新';
      this._requestFrame();
    }

    retryMaterialBackend() {
      if (this.visualizer) this.visualizer.retryMaterialBackend();
      this.lastStatus = '正在重新检测背景材质后端';
      this._requestFrame();
    }

    setGlassMaterialSettings(args) {
      if (this.visualizer) {
        this.visualizer.setGlassSettings(
          args.COLOR,
          clamp(finiteNumber(args.ALPHA, 22) / 100, 0, 1),
          clamp(finiteNumber(args.SATURATION, 125) / 100, 0, 3),
          clamp(finiteNumber(args.NOISE, 3.5) / 100, 0, 0.25)
        );
      }
      this.lastStatus = '毛玻璃参数已更新';
      this._requestFrame();
    }

    setDebugRendering(args) {
      if (this.visualizer) this.visualizer.setDebugHitboxes(parseOnOff(args.STATE));
      this.lastStatus = parseOnOff(args.STATE) ? '碰撞体调试渲染已开启' : '碰撞体调试渲染已关闭';
      this._requestFrame();
    }

    redrawBattleBox() {
      if (this.visualizer) {
        this.visualizer.markDirty();
        this.visualizer.render(this.soul, true);
      }
    }

    setManualInput(args) {
      this.manualInputX = clamp(finiteNumber(args.X, 0), -1, 1);
      this.manualInputY = clamp(finiteNumber(args.Y, 0), -1, 1);
      this.manualJumpDown = parseOnOff(args.JUMP);
    }

    setAreaBox(args) {
      this._safeCommand(() => {
        if (this.tweenSystem) this.tweenSystem.stop(args.ID);
        this.manager.setAreaBox(args.ID, args.ROLE, args.X, args.Y, args.W, args.H, args.R);
        this.soul.clearRecoveryAnchor();
        this.lastStatus = '战斗区域已更新';
      });
    }

    setAreaCircle(args) {
      this._safeCommand(() => {
        if (this.tweenSystem) this.tweenSystem.stop(args.ID);
        this.manager.setAreaCircle(args.ID, args.ROLE, args.X, args.Y, args.R);
        this.soul.clearRecoveryAnchor();
        this.lastStatus = '战斗区域已更新';
      });
    }

    setAreaCapsule(args) {
      this._safeCommand(() => {
        if (this.tweenSystem) this.tweenSystem.stop(args.ID);
        this.manager.setAreaCapsule(args.ID, args.ROLE, args.X, args.Y, args.HH, args.R, args.ROT);
        this.soul.clearRecoveryAnchor();
        this.lastStatus = '战斗区域已更新';
      });
    }

    setAreaPolygon(args) {
      this._safeCommand(() => {
        if (this.tweenSystem) this.tweenSystem.stop(args.ID);
        this.manager.setAreaPolygon(args.ID, args.ROLE, args.X, args.Y, args.POINTS, args.ROT);
        this.soul.clearRecoveryAnchor();
        this.lastStatus = '多边形战斗区域已更新';
      });
    }

    startBoxTween(args) {
      this._safeCommand(() => {
        const id = safeId(args.ID);
        const target = {
          x: args.X,
          y: args.Y,
          width: args.W,
          height: args.H,
          roundness: args.R,
          rotation: args.ROT
        };
        if (!this.tweenSystem.start(
          id,
          target,
          args.SECONDS,
          args.CURVE,
          args.DIRECTION,
          args.CONFLICT
        )) {
          throw new Error(`找不到可过渡的圆角框，或新过渡被忽略：${id}`);
        }
        this.lastStatus = `圆角框 ${id} 开始过渡`;
      });
    }

    tweenBoxProperty(args) {
      this._safeCommand(() => {
        const id = safeId(args.ID);
        const current = this.manager.getAreaBoxState(id);
        if (!current) throw new Error(`找不到圆角框：${id}`);
        const property = Cast.toString(args.PROPERTY);
        const allowed = ['x', 'y', 'width', 'height', 'roundness', 'rotation'];
        if (allowed.indexOf(property) < 0) throw new Error(`不支持的过渡属性：${property}`);
        const target = {};
        target[property] = finiteNumber(args.VALUE, current[property]);
        if (!this.tweenSystem.start(
          id,
          target,
          args.SECONDS,
          args.CURVE,
          args.DIRECTION,
          args.CONFLICT
        )) {
          throw new Error(`无法启动圆角框过渡：${id}`);
        }
        this.lastStatus = `圆角框 ${id} 的 ${property} 开始过渡`;
      });
    }

    stopBoxTween(args) {
      const id = safeId(args.ID);
      this.tweenSystem.stop(id);
      this.lastStatus = `已停止圆角框 ${id} 的过渡`;
      this._requestFrame();
    }

    finishBoxTween(args) {
      const id = safeId(args.ID);
      if (!this.tweenSystem.finish(id)) {
        this.lastStatus = `圆角框 ${id} 没有正在进行的过渡`;
      } else {
        this.lastStatus = `已立即完成圆角框 ${id} 的当前过渡`;
      }
      if (this.visualizer) this.visualizer.markDirty();
      this._requestFrame();
    }

    stopAllBoxTweens() {
      this.tweenSystem.stopAll();
      this.lastStatus = '已停止所有框过渡';
      this._requestFrame();
    }

    setBoxTweensPaused(args) {
      this.tweenSystem.paused = parseOnOff(args.STATE);
      this.lastStatus = this.tweenSystem.paused ? '所有框过渡已暂停' : '所有框过渡已继续';
      this._idleTweenLastTime = -1;
      this._requestFrame();
    }

    isBoxTweening(args) {
      return this.tweenSystem.isTweening(args.ID);
    }

    getBoxTweenProgress(args) {
      return this.tweenSystem.getProgress(args.ID) * 100;
    }

    getBoxTweenCurve(args) {
      return this.tweenSystem.getCurveName(args.ID);
    }

    setSingleBoxEffect(args) {
      this._safeCommand(() => {
        const id = safeId(args.ID);
        if (!this.effectSystem.setForBox(
          id, args.EFFECT, args.STRENGTH, args.SPEED, args.SECONDS, args.MODE
        )) {
          throw new Error(`找不到框：${id}`);
        }
        this._effectLastTime = -1;
        this.lastStatus = `框 ${id} 已启用${boxEffectTypeName(args.EFFECT)}动效`;
      });
    }

    setAllBoxesEffect(args) {
      this._safeCommand(() => {
        this.effectSystem.setForAll(
          args.EFFECT, args.STRENGTH, args.SPEED, args.SECONDS, args.MODE
        );
        this._effectLastTime = -1;
        this.lastStatus = `全部框已启用${boxEffectTypeName(args.EFFECT)}动效`;
      });
    }

    stopSingleBoxEffect(args) {
      const id = safeId(args.ID);
      this.effectSystem.stopForBox(id);
      this.lastStatus = `已停止框 ${id} 的单框动效`;
      if (this.visualizer) this.visualizer.markDirty();
      this._requestFrame();
    }

    stopAllBoxesEffect() {
      this.effectSystem.stopForAll();
      this.lastStatus = '已停止全部框统一动效';
      if (this.visualizer) this.visualizer.markDirty();
      this._requestFrame();
    }

    clearAllBoxEffects() {
      this.effectSystem.clearAllEffects();
      this.lastStatus = '已清除所有框动效';
      if (this.visualizer) this.visualizer.markDirty();
      this._requestFrame();
    }

    setBoxEffectsPaused(args) {
      this.effectSystem.paused = parseOnOff(args.STATE);
      this._effectLastTime = -1;
      this.lastStatus = this.effectSystem.paused ? '框动效已暂停' : '框动效已继续';
      this._requestFrame();
    }

    setBoxEffectRefreshRate(args) {
      this.effectSystem.setRefreshRate(args.FPS);
      this.lastStatus = `框动效刷新率：${this.effectSystem.refreshRate} FPS`;
      if (this.visualizer) this.visualizer.markDirty();
      this._requestFrame();
    }

    isBoxEffectActive(args) {
      return this.effectSystem.isActiveForBox(args.ID);
    }

    getBoxEffectName(args) {
      return this.effectSystem.getEffectNameForBox(args.ID);
    }

    getAllBoxesEffectName() {
      return this.effectSystem.getGlobalEffectName();
    }

    setHitboxBox(args) {
      this._safeCommand(() => {
        this.manager.setHitboxBox(
          args.ID, args.RESPONSE, args.LAYER, args.DAMAGE,
          args.X, args.Y, args.W, args.H, args.R, args.ROT
        );
        this.soul.clearRecoveryAnchor();
        this.lastStatus = '矩形碰撞体已更新';
      });
    }

    setHitboxCircle(args) {
      this._safeCommand(() => {
        this.manager.setHitboxCircle(
          args.ID, args.RESPONSE, args.LAYER, args.DAMAGE,
          args.X, args.Y, args.R
        );
        this.soul.clearRecoveryAnchor();
        this.lastStatus = '圆形碰撞体已更新';
      });
    }

    setHitboxCapsule(args) {
      this._safeCommand(() => {
        this.manager.setHitboxCapsule(
          args.ID, args.RESPONSE, args.LAYER, args.DAMAGE,
          args.X, args.Y, args.HH, args.R, args.ROT
        );
        this.soul.clearRecoveryAnchor();
        this.lastStatus = '胶囊碰撞体已更新';
      });
    }

    setObjectTransform(args) {
      this._safeCommand(() => {
        if (this.tweenSystem) this.tweenSystem.stop(args.ID);
        if (!this.manager.setObjectTransform(args.ID, args.X, args.Y, args.ROT, args.SX, args.SY)) {
          throw new Error(`找不到对象：${safeId(args.ID)}`);
        }
        this.soul.clearRecoveryAnchor();
        this.lastStatus = '对象变换已更新';
      });
    }

    setObjectEnabled(args) {
      this._safeCommand(() => {
        if (!this.manager.setObjectEnabled(args.ID, parseOnOff(args.STATE))) {
          throw new Error(`找不到对象：${safeId(args.ID)}`);
        }
        this.soul.clearRecoveryAnchor();
        this.lastStatus = '对象启用状态已更新';
      });
    }

    setHitboxDamage(args) {
      this._safeCommand(() => {
        if (!this.manager.setHitboxDamage(args.ID, args.DAMAGE)) {
          throw new Error(`找不到碰撞体：${safeId(args.ID)}`);
        }
      });
    }

    deleteObject(args) {
      this._safeCommand(() => {
        if (this.tweenSystem) this.tweenSystem.stop(args.ID);
        if (this.effectSystem) this.effectSystem.stopForBox(args.ID);
        if (!this.manager.deleteObject(args.ID)) {
          throw new Error(`找不到对象：${safeId(args.ID)}`);
        }
        this.soul.clearRecoveryAnchor();
        this.lastStatus = '对象已删除';
      });
    }

    setSoulPosition(args) {
      this._safeCommand(() => {
        const x = safeCoordinate(args.X);
        const y = safeCoordinate(args.Y);
        const legal = this.manager.isCircleLegal(x, y, this.soul.radius);
        this.soul.setPosition(x, y, legal, false);
        this.clock.reset();
        this._syncBoundTarget();
        this.lastStatus = legal ? '灵魂位置已设置' : '灵魂位置已设置，但当前位置不合法';
      });
    }

    setSoulRadius(args) {
      this.soul.radius = safeSize(args.R, 8);
      this.soul.clearRecoveryAnchor();
      this._requestFrame();
    }

    setSoulMode(args) {
      const mode = Cast.toString(args.MODE).toLowerCase() === 'blue' ? 'blue' : 'red';
      if (this.soul.mode !== mode) {
        this.soul.mode = mode;
        this.soul.gravityVelocity.set(0, 0);
        this.soul.inputVelocity.set(0, 0);
        this.soul.isGrounded = false;
        this.soul.surfaceSlidingThisStep = false;
        this.soul.gravitySlidingThisStep = false;
        this.soul._lastContactNormal.set(0, 0);
      }
    }

    setGravityDirection(args) {
      this.gravity.setDirection(Cast.toString(args.DIRECTION).toLowerCase());
    }

    setMovementProperties(args) {
      this.controller.speed = Math.max(0, finiteNumber(args.SPEED, 180));
      this.controller.jumpForce = Math.max(0, finiteNumber(args.JUMP, 360));
      this.controller.gravityAccel = Math.max(0, finiteNumber(args.GRAVITY, 1440));
      this.controller.maxFall = Math.max(0, finiteNumber(args.MAXFALL, 480));
    }

    setSlopeGripProperties(args) {
      this.controller.surfaceInputRoutingEnabled = parseOnOff(args.STATE);
      this.controller.surfaceProbeDistance = Math.max(
        0,
        Math.min(8, finiteNumber(args.DIST, 1.25))
      );
      this.controller.surfaceSpeedPreservation = Math.max(
        0,
        Math.min(1, finiteNumber(args.PERCENT, 100) / 100)
      );
      this.soul.surfaceSlidingThisStep = false;
      this.lastStatus = this.controller.surfaceInputRoutingEnabled
        ? '斜面蹭墙已开启'
        : '斜面蹭墙已关闭';
    }

    setBlueSlopeGravitySlide(args) {
      this.controller.slopeGravitySlidingEnabled = parseOnOff(args.STATE);
      this.controller.slopeGravityScale = Math.max(
        0,
        Math.min(4, finiteNumber(args.PERCENT, 100) / 100)
      );
      this.soul.gravitySlidingThisStep = false;
      this.lastStatus = this.controller.slopeGravitySlidingEnabled
        ? '蓝魂斜墙自然下滑已开启'
        : '蓝魂斜墙自然下滑已关闭';
    }

    setExternalVelocity(args) {
      this.soul.externalVelocity.set(
        finiteNumber(args.X, 0),
        finiteNumber(args.Y, 0)
      );
    }

    setHealth(args) {
      this.health = Math.max(0, finiteNumber(args.HP, 20));
    }

    setInvulnerabilityDuration(args) {
      this.soul.invulnerabilityDuration = Math.max(0, finiteNumber(args.SECONDS, 1));
    }

    getLastCompletedTweenId() {
      return this.lastCompletedTweenId || '';
    }


    getLastCompletedEffectId() {
      return this.lastCompletedEffectId;
    }

    getSoulX() {
      return Number.isFinite(this.soul.x) ? this.soul.x : 0;
    }

    getSoulY() {
      return Number.isFinite(this.soul.y) ? this.soul.y : 0;
    }

    getHealth() {
      return Number.isFinite(this.health) ? this.health : 0;
    }

    isGrounded() {
      return Boolean(this.soul.isGrounded);
    }

    isSurfaceSliding() {
      return Boolean(this.soul.surfaceSlidingThisStep);
    }

    isBlueSlopeGravitySliding() {
      return Boolean(this.soul.gravitySlidingThisStep);
    }

    isPhysicsRunning() {
      return Boolean(this.running);
    }

    recoveryFailed() {
      return Boolean(this.soul.recoveryFailedThisStep);
    }

    getLastHitId() {
      return this.lastHitId || '';
    }

    getLastHitDamage() {
      return Number.isFinite(this.lastHitDamage) ? this.lastHitDamage : 0;
    }

    objectExists(args) {
      return Boolean(this.manager.hasObject(args.ID));
    }

    getObjectCount() {
      return this.manager.getObjectCount();
    }

    getLastError() {
      return this.lastError || '';
    }

    getStatus() {
      return this.lastStatus || '';
    }

    getRenderBackend() {
      return this.visualizer ? this.visualizer.getBackendName() : '渲染器未初始化';
    }

    getRenderLayerMode() {
      return this.visualizer ? this.visualizer.getLayerModeName() : '渲染器未初始化';
    }

    getBackgroundMaterial() {
      return this.visualizer ? this.visualizer.getMaterialName() : '纯色';
    }

    getBackgroundMaterialBackend() {
      return this.visualizer ? this.visualizer.getMaterialBackendName() : '渲染器未初始化';
    }

    getBlurAlgorithm() {
      return this.visualizer ? this.visualizer.getBlurAlgorithmName() : '渲染器未初始化';
    }

    getBattleBoxTextureScale() {
      return this.visualizer ? this.visualizer.getTextureScale() : 1;
    }

    getCameraCompatibilityStatus() {
      const rendererStatus = this.visualizer
        ? this.visualizer.getCameraCompatibilityStatus()
        : '战斗框渲染器未初始化';
      const target = this.boundTarget;
      if (!target || !Number.isFinite(target.drawableID)) return rendererStatus;
      const renderer = vm && vm.renderer;
      const drawable = renderer && renderer._allDrawables && renderer._allDrawables[target.drawableID];
      const cameraState = findCameraV2State(drawable);
      if (!cameraState) return `${rendererStatus}；绑定灵魂未检测到 Camera V2`;
      const mode = this.cameraSoulVisualMode === 'pixel' ? '分数倍率像素锁定' : '平滑插值采样';
      return `${rendererStatus}；绑定灵魂 Camera V2 缩放 ${Math.abs(cameraState.ogSZ).toFixed(3)}×，${mode}；${this._cameraSoulScaleStatus}`;
    }

    getCameraSoulVisualDiagnostic() {
      const target = this.boundTarget;
      if (!target || !Number.isFinite(target.drawableID)) return '未绑定灵魂角色';
      const renderer = vm && vm.renderer;
      const drawable = renderer && renderer._allDrawables && renderer._allDrawables[target.drawableID];
      if (!drawable) return '绑定灵魂 Drawable 不存在';
      const cameraState = findCameraV2State(drawable);
      if (!cameraState) return '绑定灵魂未检测到 Camera V2';
      const zoom = Math.abs(Number(cameraState.ogSZ));
      const logicalSize = Math.abs(Number(target.size));
      const scale = readDrawableScale(drawable);
      const expected = Number.isFinite(zoom) && Number.isFinite(logicalSize) ? zoom * logicalSize : NaN;
      const actual = scale ? `${Math.abs(Number(scale[0])).toFixed(2)}×${Math.abs(Number(scale[1])).toFixed(2)}` : '无法读取';
      const sampling = this.cameraSoulVisualMode === 'pixel' ? '最近邻/物理像素中心锁定' : 'Renderer 默认/插值';
      return `逻辑大小 ${Number.isFinite(logicalSize) ? logicalSize.toFixed(2) : '?'}，摄像机 ${Number.isFinite(zoom) ? zoom.toFixed(3) : '?'}×，Drawable ${actual}，期望 ${Number.isFinite(expected) ? expected.toFixed(2) : '?'}，${sampling}，缩放写入 0 次；${this._cameraSoulScaleStatus}`;
    }

    getAdaptiveCameraRenderingStatus() {
      return this.visualizer
        ? this.visualizer.getAdaptiveViewportStatus()
        : '摄像机自适应渲染器未初始化';
    }

    getGpuMemoryGuardStatus() {
      return this.visualizer
        ? this.visualizer.getGpuMemoryGuardStatus()
        : '显存保护渲染器未初始化';
    }

    getInteriorClipBackend() {
      return this.visualizer ? this.visualizer.getInteriorClipBackendName() : '渲染器未初始化';
    }

    getJoystickX() {
      return this.mobileJoystick ? this.mobileJoystick.getInput().x : 0;
    }

    getJoystickY() {
      return this.mobileJoystick ? this.mobileJoystick.getInput().y : 0;
    }

    getJoystickAngle() {
      return this.mobileJoystick ? this.mobileJoystick.getInput().angle : 0;
    }

    getJoystickDistance() {
      return this.mobileJoystick ? this.mobileJoystick.getInput().distance * 100 : 0;
    }

    isJoystickActive() {
      return Boolean(this.mobileJoystick && this.mobileJoystick.getInput().active);
    }

    isMobileButtonDown(args) {
      return Boolean(this.mobileJoystick && this.mobileJoystick.getButtonState(args.ID).held);
    }

    wasMobileButtonPressed(args) {
      return Boolean(this.mobileJoystick && this.mobileJoystick.getButtonState(args.ID).justPressed);
    }

    wasMobileButtonReleased(args) {
      return Boolean(this.mobileJoystick && this.mobileJoystick.getButtonState(args.ID).justReleased);
    }

    getMobileButtonCount() {
      return this.mobileJoystick ? this.mobileJoystick.getButtonCount() : 0;
    }

    getLastMobileButtonId() {
      return this.lastMobileButtonId || '';
    }

    getInputBackend() {
      const sources = [];
      if (this.keyboardEnabled) sources.push('键盘（DOM捕获 + Scratch Keyboard）');
      if (this.mobileJoystick && this.mobileJoystick.enabled) sources.push(this.mobileJoystick.getBackendName());
      if (Math.abs(this.manualInputX) > 0 || Math.abs(this.manualInputY) > 0 || this.manualJumpDown) sources.push('手动输入积木');
      return sources.length ? sources.join(' + ') : '没有启用输入源';
    }

    getVersion() {
      return 'UTBattleBox V21.0 Phase 4C.16 OrganizedBlockPalette';
    }
  }

  const extensionInstance = new UTBattleBoxExtension();
  ScratchAPI.extensions.register(extensionInstance);
  globalEnv.__UTBattleBoxV21Phase4C16Registered = true;
  globalEnv.__UTBattleBoxV21Phase4C15Registered = true;
  globalEnv.__UTBattleBoxV21Phase4C14Registered = true;
  globalEnv.__UTBattleBoxV21Phase4C13FractionalZoomRegistered = true;
  globalEnv.__UTBattleBoxV21Phase4C13Registered = true;
  globalEnv.__UTBattleBoxV21Phase4C12Registered = true;
  globalEnv.__UTBattleBoxV21Phase4C11Registered = true;
  globalEnv.__UTBattleBoxV21Phase4C10Registered = true;
  globalEnv.__UTBattleBoxV21Phase4C9Registered = true;
  globalEnv.__UTBattleBoxV21Phase4C8Registered = true;
  globalEnv.__UTBattleBoxV21Phase4C7Registered = true;
  globalEnv.__UTBattleBoxV21Phase4C6Registered = true;
  globalEnv.__UTBattleBoxV21Phase4C5Registered = true;
  globalEnv.__UTBattleBoxV21Phase4C4Registered = true;
  globalEnv.__UTBattleBoxV21Phase4C3Registered = true;
  globalEnv.__UTBattleBoxV21Phase4C2Registered = true;
  globalEnv.__UTBattleBoxV21Phase4C1Registered = true;
  globalEnv.__UTBattleBoxV21Phase4C0Registered = true;
  globalEnv.__UTBattleBoxV21Phase4B9Registered = true;
  globalEnv.__UTBattleBoxV21Phase4B8Registered = true;
  globalEnv.__UTBattleBoxV21Phase4B7Registered = true;
  globalEnv.__UTBattleBoxV21ExtensionRegistered = true;
  globalEnv.UTBattleBoxV21Extension = extensionInstance;
  globalEnv.UTBattleBoxBattleWorldManager = BattleWorldManager;
  globalEnv.UTBattleBoxTweenSystem = BoxTweenSystem;
  globalEnv.UTBattleBoxMobileJoystickController = MobileJoystickController;
  globalEnv.UTBattleBoxSoulController = SoulController;
  globalEnv.UTBattleBoxStable60Renderer = BattleBoxRenderer;
  globalEnv.UTBattleBoxFrameBudgetRenderer = BattleBoxRenderer;
  globalEnv.UTBattleBoxPerformanceRenderer = BattleBoxRenderer;
  globalEnv.UTBattleBoxAdaptiveCameraViewportRenderer = BattleBoxRenderer;
  globalEnv.UTBattleBoxContinuousFrameDriverExtension = extensionInstance;
  globalEnv.UTBattleBoxGpuMemoryGuardRenderer = extensionInstance.visualizer;
  globalEnv.UTBattleBoxCameraScaleBridge = {
    mode: 'camera-v2-fractional-zoom-pixel-lock',
    ensureGuard: ensureCameraV2ScaleCopyGuard,
    writeSoulTransform: function () { return false; },
    findState: findCameraV2State,
    snapWorldPosition: snapCameraV2WorldPosition
  };
  globalEnv.UTBattleBoxCameraPixelLock = {
    snapWorldPosition: snapCameraV2WorldPosition,
    getPixelGrid: getRendererPhysicalPixelGrid
  };
  globalEnv.UTBattleBoxBoxEffectSystem = BoxEffectSystem;
  globalEnv.UTBattleBoxBoxEffectsRenderer = BattleBoxRenderer;
  globalEnv.UTBattleBoxSupersampleAnchorRenderer = BattleBoxRenderer;
  globalEnv.UTBattleBoxCameraCompatibleRenderer = BattleBoxRenderer;
  globalEnv.UTBattleBoxStencilClipRenderer = BattleBoxRenderer;
  globalEnv.UTBattleBoxBackdropMaterialRenderer = BattleBoxRenderer;
  globalEnv.UTBattleBoxFullscreenCoordinateRenderer = BattleBoxRenderer;
  globalEnv.UTBattleBoxNativeRenderer = BattleBoxRenderer;
  globalEnv.UTBattleBoxBattleRenderer = BattleBoxRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
