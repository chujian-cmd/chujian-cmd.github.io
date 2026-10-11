       var barAnimation = function(domID, data) {
           var main = this;

           main.svg = null;
           var chartWidth = parseInt(d3.select("#" + domID).style("width"));
           var margin = {
               top: 10,
               right: 15,
               bottom: 30,
               left: 40
           };
           main.width = chartWidth - margin.left - margin.right;
           main.height = 150 - margin.top - margin.bottom;

           var formatPercent = d3.format(".0%");

           var x = d3.scale.ordinal()
               .rangeRoundBands([0, main.width + margin.left + margin.right], .1);

           var y = d3.scale.linear()
               .range([main.height, 0]);

           var xAxis = d3.svg.axis()
               .scale(x)
               .orient("bottom");

           var yAxis = d3.svg.axis()
               .scale(y)
               .orient("left")
               .tickFormat(formatPercent);

           main.data = data;

           main.init = function(domID) {
               main.domID = domID;

               d3.select("#" + domID + " svg").remove();
               main.svg = d3.select("#" + domID).append("svg")
                   .attr("width", main.width + margin.left + margin.right)
                   .attr("height", main.height + margin.top + margin.bottom)
                   .append("g")
                   .attr("transform", "translate(" + (0) + "," + margin.top + ")");

               x.domain(main.data.map(function(d) {
                   return d.Info;
               }));

               y.domain([0, d3.max(data, function(d) {
                   if (d.Value >= 1000) {
                       if (d.Value % 100 != 0)
                           return (parseInt(d.Value / 100) + 1) * 100;
                       else
                           return d.Value;
                   } else if (d.Value > 100) {
                       if (d.Value % 10 != 0)
                           return (parseInt(d.Value / 10) + 1) * 10;
                       else
                           return d.Value;
                   }
                   return d.Value;
               })]);

               var height = main.height;

               var mychart = main.svg.selectAll(".bar")
                   .data(data)
                   .enter().append("rect")
                   .attr("class", "bar")
                   .attr("id", function(d) {
                       return "bar_" + (d.Info + 1);
                   })
                   .attr("rx", function(d) {
                       if (d.Value <= 0)
                           return 4;
                       else
                           return 8;
                   })
                   .attr("ry", function(d) {
                       if (d.Value == 0)
                           return 4;
                       else
                           return 8;
                   })
                   .attr("x", function(d) {
                       // if (d.Info != 1)
                       return x(d.Info) + 5;
                       // else 
                       // 	return x(d.Info);
                   })
                   .attr("width", x.rangeBand() - 10)
                   .attr("y", function(d) {
                       return height;
                   })
                   .attr("fill", function(d) {
                       if (d.Value >= 0)
                           return "rgb(187, 242, 255)";
                       else
                           return "#f7f7f7";
                   })
                   .attr("height", function(d) {
                       return 0;
                   })
                   .on("click", main.mouseClick);

               mychart.transition()
                   .attr("y", function(d) {
                       var tmp = 0;
                       if (d.Value <= 0)
                           tmp = 0;
                       else
                           tmp = d.Value;
                       return y(tmp) - 8;
                   })
                   .duration(800)
                   .ease(d3.easeCubicInOut)
                   .attr("height", function(d) {
                       var tmp = 0;
                       if (d.Value <= 0)
                           tmp = 0;
                       else
                           tmp = d.Value;
                       return height - y(tmp) + 8;
                   })
                   .each("end", function(d) {
                       if (d3.select(this).attr("id") != "bar_5")
                           return;
                       main.highlight();
                   });

               var gloss = main.svg.selectAll(".gloss")
                   .data(data)
                   .enter().append("rect")
                   .attr("class", "gloss")
                   .attr("rx", 4)
                   .attr("ry", 4)
                   .attr("x", function(d) {
                       return x(d.Info) + 13;
                   })
                   .attr("width", function(d) {
                       return 10;
                   })
                   .attr("height", 0)
                   .attr("y", function(d) {
                       return height;
                   });


               gloss.transition()
                   .attr("height", function(d) {
                       if (d.Value <= 0)
                           return 0;
                       else {
                           if (height - y(d.Value) - 12 > 0)
                               return height - y(d.Value) - 12;
                           else
                               return 0;
                       }
                   })
                   .attr("y", function(d) {
                       if (d.Value <= 0)
                           return 0;
                       else
                           return y(d.Value) + 4;
                   })
                   .duration(800)
                   .ease(d3.easeCubicInOut)
                   .each("end", function() {});
           }

           main.mouseClick = function(clickElement) {

               $(".barTooltip").hide();

               d3.selectAll(".bar")
                   .attr("fill", function(d, i) {
                       if (clickElement !== d) {
                           if (d.Value != -1)
                               return "rgb(187, 242, 255)";
                           else {
                               return "#f7f7f7";
                           }
                       } else {
                           if (d.Value != -1)
                               return "rgb(71, 215, 255)";
                           else
                               return "#f7f7f7";
                       }
                   });

               if (clickElement.Value < 0)
                   return false;

               var rect = d3.select(this).node().getBBox();
               var fontsize = parseFloat(28 * ratio) + "px";
               var weeks = ["四周前", "三周前", "两周前", "上周", "本周"];
               var html = "<span class='tooltipTitle' style='font-size: " + fontsize + "'>" + weeks[clickElement.Info] + "</span><br/>";
               html += "<span class='tooltipData' style='font-size: " + fontsize + "'>" + clickElement.Value + "</span> 经验";

               $(".barTooltip").html(html);

               $(".barTooltip").css({
                   "left": (rect.x + rect.width / 2 - $(".barTooltip").outerWidth() / 2) + "px",
                   "top": (rect.y - 8 - $(".barTooltip").outerHeight()) + "px"
               });
               $(".barTooltip").show();
           }

           main.highlight = function() {
               d3.select("#bar_5")
                   .transition()
                   .duration(200)
                   .ease("linear")
                   .attr("fill", "rgb(71, 215, 255)")
                   .each("end", function() {
                       var rect = d3.select("#bar_5").node().getBBox();

                       var fontsize = parseFloat(28 * ratio) + "px";

                       var html = "<span class='tooltipTitle' style='font-size: " + fontsize + "'>" + "本周" + "</span><br/>";
                       html += "<span class='tooltipData' style='font-size: " + fontsize + "'>" + main.data[4].Value + "</span> 经验";

                       $(".barTooltip").html(html);

                       $(".barTooltip").fadeOut(10).animate({
                           "left": (rect.x + rect.width / 2 - $(".barTooltip").outerWidth() / 2) + "px",
                           "top": (rect.y - 8 - $(".barTooltip").outerHeight()) + "px",
                           "opacity": 0
                       }).fadeIn(10).animate({
                           "display": "block",
                           "opacity": 1
                       });
                   });
           }

           main.init(domID);
       }

       function easeInOutQuad(t, b, c, d) {
           t /= d / 2;
           if (t < 1)
               return c / 2 * t * t + b;
           t--;
           return -c / 2 * (t * (t - 2) - 1) + b;
       }

       function closestPoint(pathNode, point) {
           var pathLength = pathNode.getTotalLength(),
               precision = 8,
               best,
               bestLength,
               bestDistance = Infinity;

           // linear scan for coarse approximation
           for (var scan, scanLength = 0, scanDistance; scanLength <= pathLength; scanLength += precision) {
               if ((scanDistance = distance2(scan = pathNode.getPointAtLength(scanLength))) < bestDistance) {
                   best = scan, bestLength = scanLength, bestDistance = scanDistance;
               }
           }

           // binary search for precise estimate
           precision /= 2;
           while (precision > 0.5) {
               var before,
                   after,
                   beforeLength,
                   afterLength,
                   beforeDistance,
                   afterDistance;
               if ((beforeLength = bestLength - precision) >= 0 && (beforeDistance = distance2(before = pathNode.getPointAtLength(beforeLength))) < bestDistance) {
                   best = before, bestLength = beforeLength, bestDistance = beforeDistance;
               } else if ((afterLength = bestLength + precision) <= pathLength && (afterDistance = distance2(after = pathNode.getPointAtLength(afterLength))) < bestDistance) {
                   best = after, bestLength = afterLength, bestDistance = afterDistance;
               } else {
                   precision /= 2;
               }
           }

           best = [best.x, best.y];
           best.distance = Math.sqrt(bestDistance);
           return best;

           function distance2(p) {
               var dx = p.x - point[0],
                   dy = p.y - point[1];
               return dx * dx + dy * dy;
           }
       }

       d3.selection.prototype.position = function() {

           var el = this.node();
           var elPos = el.getBoundingClientRect();
           var vpPos = getVpPos(el);

           function getVpPos(el) {
               if (el.parentElement.tagName === 'svg') {
                   return el.parentElement.getBoundingClientRect();
               }
               return getVpPos(el.parentElement);
           }

           return {
               top: elPos.top - vpPos.top,
               left: elPos.left - vpPos.left,
               width: elPos.width,
               bottom: elPos.bottom - vpPos.top,
               height: elPos.height,
               right: elPos.right - vpPos.left
           };
       };

       var chinese_weekday = ['', '一', '二', '三', '四', '五', '六', '日'];
       var formatDay = function(d) {
           return chinese_weekday[(d - 1) % 8];
       }

       var lineAnimation = function(domID, data) {
           var main = this;

           main.parseDate = d3.time.format("%Y").parse;
           var bisectDate = d3.bisector(function(d) {
               return d.date;
           }).right;
           var formatValue = d3.format(",");
           var dateFormatter = d3.time.format("%m/%d/%y");

           main.svg = null;

           var chartwidth = parseInt(d3.select("#" + domID).style("width"));
           var margin = {
               top: 5,
               right: 15,
               bottom: 30,
               left: 40
           };
           main.width = chartwidth - margin.left - margin.right;
           main.height = chartwidth * 220 / 329 - margin.top - margin.bottom;

           main.touchPoint = 0;

           main.inner_circle = null;

           main.touchStatus = false;

           var x = d3.time.scale()
               .range([0, main.width]);

           var max_value = 0;

           main.data = [];
           for (var i = 0; i < data.date.length; i++) {
               main.data.push({
                   'date': data.date[i],
                   'amount': data.amount[i],
                   'avg': data.avg[i],
                   'tmp': data.avg[i]
               })
           }

           for (var i = 0; i < main.data.length; i++) {
               if (max_value < main.data[i].avg)
                   max_value = main.data[i].avg;

               if (max_value < main.data[i].amount)
                   max_value = main.data[i].amount;
           }

           if (max_value > 1000) {
               if (max_value % 100 != 0)
                   max_value = (parseInt(max_value / 100) + 1) * 100;
           } else if (max_value > 100) {
               if (max_value % 10 != 0)
                   max_value = (parseInt(max_value / 10) + 1) * 10;
           }

           var y = d3.scale.linear()
               .domain([max_value, 0])
               .range([main.height, 20]);

           var xAxis = d3.svg.axis()
               .scale(x)
               .orient("bottom")
               .tickFormat(formatDay)
               .tickSize(5);

           var yAxis = d3.svg.axis()
               .scale(y)
               .orient("left")
               .ticks(4)
               .tickFormat(function(d) {
                   return d;
               })
               .tickSize(-main.width);

           main.focus = null;
           main.tip_line = null;

           main.init = function(domID) {
               main.domID = domID;

               var color = d3.scale.category10();

               d3.select("#" + domID + " svg").remove();

               var line = d3.svg.line()
                   .interpolate("monotone")
                   .x(function(d) {
                       return x(d.date);
                   })
                   .y(function(d) {
                       return y(d.population);
                   });

               main.svg = d3.select("#" + domID).append("svg")
                   .attr("class", "svgele")
                   .attr("id", "svgEle")
                   .attr("width", main.width + margin.left + margin.right)
                   .attr("height", main.height + margin.top + margin.bottom + 30)
                   .append("g")
                   .attr("transform", "translate(" + margin.left + "," + (margin.top) + ")");

               color.domain(d3.keys(main.data[0]).filter(function(key) {
                   return key !== "date";
               }));

               projections = color.domain().map(function(name) {
                   return {
                       name: name,
                       values: main.data.map(function(d) {
                           return {
                               date: d.date,
                               population: +d[name]
                           };
                       })
                   };
               });

               x.domain(d3.extent(main.data, function(d) {
                   return d.date;
               }));

               y.domain([
                   main.data[0].amount,
                   max_value
               ]);

               main.svg.append("g")
                   .attr("class", "x axis")
                   .style("font-size", 28 * ratio)
                   .attr("transform", "translate(0," + (main.height) + ")")
                   .call(xAxis);

               main.svg.append("g")
                   .attr("class", "y axis")
                   .style("font-size", "14px")
                   .attr("id", "yAxis")
                   .call(yAxis);

               var proj = main.svg.selectAll(".proj")
                   .data(projections)
                   .enter()
                   .append("g")
                   .attr("class", "proj");

               proj.append("path")
                   .attr("class", "line")
                   .attr("id", function(d, i) {
                       return "line" + i;
                   })
                   .attr("stroke-linecap", "round")
                   .attr("d", function(d, i) {
                       if (i == 2) {
                           // d.values.pop();
                           return line(d.values);
                       } else
                           return line(d.values);
                   })
                   .style("stroke", function(d) {
                       return 'rgb(71, 215, 255)';
                   });

               main.addTooltip(main.data, x, y, 0);

               d3.selectAll(".line").style("opacity", "0");
               main.animatelines(main.data, x, y);
           }

           main.animatelines = function(data, xFunc, yFunc) {
               d3.selectAll(".line").style("opacity", "1");
               d3.selectAll(".line").each(function(d, i) {

                   var totalLength = d3.select("#line" + i).node().getTotalLength();

                   d3.selectAll("#line" + i).attr("stroke-dasharray", totalLength + " " + totalLength)
                       .attr("stroke-dashoffset", totalLength)
                       .transition()
                       .duration(500)
                       .delay(100 * i)
                       .ease(d3.easeCubicInOut)
                       .attr("stroke-dashoffset", 0)
                       .style("stroke-width", 4)
                       .style("stroke", function() {
                           if (i == 0)
                               return 'rgb(222, 222, 222)';
                           else
                               return 'rgb(71, 215, 255)';
                       })
                       .each('end', function() {
                           if (i == 0) {
                               main.svg.selectAll(".point")
                                   .data(main.data)
                                   .enter().append("circle")
                                   .attr("r", 0)
                                   .attr("transform", function(d) {
                                       return "translate(" + x(d.date) + "," + y(d.avg) + ")";
                                   });

                               main.inner_circle = main.svg.append("g")
                                   .attr("class", "avg_circle")
                                   .attr("transform", "translate(" + x(data[0].date) + "," + (y(0)) + ")");
                               main.inner_circle.append("circle")
                                   .attr("r", 8);

                               main.inner_circle.append("circle")
                                   .attr("class", "inner_blue")
                                   .attr("r", 5);
                           }
                           if (i == 2) {
                               var steps = 6;
                               var speed = x(main.data[7].date) - x(main.data[0].date);
                               var start = 0;
                               setTimeout(
                                   function() {
                                       main.focus.style("display", null);
                                       main.tip_line.style("display", null);
                                       main.moveLine(speed, false);
                                   }, 100);
                           }
                       });
               })
           }

           main.addTooltip = function(data, x, y, index) {
               main.tip_line = main.svg.append("line")
                   .attr("class", "tip_axis")
                   .attr("stroke-width", 2)
                   .attr("stroke", "rgb(222, 222, 222)")
                   .attr("x1", x(data[0].date))
                   .attr("y1", y(0))
                   .attr("x2", x(data[0].date))
                   .attr("y2", y(max_value));
               main.tip_line.style("display", null);

               main.focus = main.svg.append("g")
                   .attr("class", "focus focus_" + index)
                   .attr("transform", "translate(0," + (y(0)) + ")")
                   .style("display", "none");

               main.focus.transition();

               main.focus.append("circle")
                   .attr("r", 8);

               main.focus.append("circle")
                   .attr("class", "inner_white")
                   .attr("r", 5)
                   .attr("fill", "rgb(222, 222, 222)");

               main.svg.append("rect")
                   .attr("class", "overlay")
                   .attr("width", main.width)
                   .attr("height", main.height)
                   .on("click", main.mouseClick)
                   .on("touchstart", main.touchStart)
                   .on("touchmove", main.touchmove)
                   .on("touchend", main.touchEnd)
                   .on("mousemove", main.touchmove)
                   .on("mousedown", main.mouseDown)
                   .on("mouseup", main.mouseUp);

               var overlay = document.getElementsByClassName("overlay")[0];
               overlay.addEventListener('touchmove', function(e) {
                   main.nullEvent();
               }, {
                   passive: true
               });

               document.addEventListener('touchmove', function(e) {}, {
                   passive: false
               });
           }

           main.nullEvent = function() {

           }

           main.mouseDown = function() {
               main.touchStatus = true;
           }

           main.touchStart = function() {
               main.touchPoint = d3.mouse(this)[0];
               main.touchStatus = true;
           }

           main.mouseUp = function() {
               main.touchStatus = false;
           }

           main.touchEnd = function() {
               main.touchStatus = false;
           }

           main.touchmove = function() {
               d3.event.stopPropagation();
               if (d3.event.cancelable)
                   d3.event.preventDefault();
               if (!main.touchStatus)
                   return;

               var point = d3.mouse(this)[0];
               if (point < x(main.data[0].date))
                   return;
               if (point > x(main.data[main.data.length - 1].date))
                   return;
               var x0 = x.invert(point),
                   i = bisectDate(main.data, x0, 1);

               var min = 999999,
                   min_index = 0;
               for (var j = 0; j < main.data.length; j++) {
                   if (Math.abs(x(main.data[j].date) - point) < min) {
                       min = Math.abs(x(main.data[j].date) - point);
                       min_index = j;
                   }
               }

               $(".tooltip").hide();

               var d0 = main.data[i - 1],
                   d1 = main.data[i];
               d = Math.abs(x0 - d0.date) > Math.abs(d1.date - x0) ? d1 : d0;

               var yPoint = (y(d1.amount) - y(d0.amount)) / (x(d1.date) - x(d0.date)) * (point - x(d0.date)) + y(d0.amount);
               var yAvgPoint = (y(d1.avg) - y(d0.avg)) / (x(d1.date) - x(d0.date)) * (point - x(d0.date)) + y(d0.avg);

               var newPoint = closestPoint(main.svg.select("#line1")[0][0], [point, yAvgPoint]);

               main.svg.select(".tip_axis")
                   .attr("transform", "translate(" + point + ")");

               main.svg.select(".avg_circle")
                   .attr("transform", "translate(" + point + "," + newPoint[1] + ")");
               main.focus.attr("transform", "translate(" + point + "," + yPoint + ")");

               if (min_index != main.data.length - 1 && min_index != 0) {
                   if (Math.abs(point - x(main.data[min_index].date)) < Math.abs(x(main.data[min_index].date) - x(main.data[min_index + 1].date)) / 2 && min_index < 7) {
                       var fontsize = 28 * ratio + "px";
                       var html = "<span class='tooltipTitle' style='font-size: " + fontsize + "'>" + "星期" + formatDay(min_index + 1) + "</span><br/>";
                       html += "<span class='tooltipSub' style='font-size: " + fontsize + "'>" + "累计 " + "</span> <span class='tooltipData' style='font-size: " + fontsize + "'>" + main.data[min_index].avg + "</span> 经验 <span class='arrow_mark'></span>";

                       $(".tooltip").html(html);
                   }
               } else if (min_index == main.data.length - 1) {
                   if (Math.abs(point - x(main.data[min_index - 1].date)) > Math.abs(point - x(main.data[min_index].date))) {
                       var fontsize = 28 * ratio + "px";
                       var html = "<span class='tooltipTitle' style='font-size: " + fontsize + "'>" + "星期" + formatDay(min_index + 1) + "</span><br/>";
                       html += "<span class='tooltipSub' style='font-size: " + fontsize + "'>" + "累计 " + "</span> <span class='tooltipData' style='font-size: " + fontsize + "'>" + main.data[min_index].avg + "</span> 经验 <span class='arrow_mark'></span>";

                       $(".tooltip").html(html);
                   }
               } else {
                   return;
               }
               var left = main.svg.select(".tip_axis").position().left - $(".tooltip").outerWidth() / 2;
               var arrow_left;

               if (left + $(".tooltip").outerWidth() > $(".sub_main").width() * 0.97 - 8) {
                   arrow_left = left - ($(".sub_main").width() * 0.97 - $(".tooltip").outerWidth()) + 8;
                   $(".tooltip .arrow_mark").css("left", "calc(50% + " + (parseFloat(arrow_left) - 1) + "px)");
                   $(".tooltip").css("left", ($(".sub_main").width() * 0.97 - $(".tooltip").outerWidth() - 8) + "px");
               } else {
                   $(".tooltip .arrow_mark").css("left", "calc(50% - 1px)");
                   $(".tooltip").css("left", left + "px");
               }
               $(".tooltip").show();
           }

           main.mouseClick = function() {
               $(".tooltip").css({
                   'display': 'none'
               });
               main.moveLine(d3.mouse(this)[0], true);
           }

           main.moveLine = function(pointX, flag) {
               var x0 = x.invert(pointX),
                   i = bisectDate(main.data, x0, 1),
                   d0 = main.data[i - 1],
                   d1, d;
               if (i == 8)
                   d1 = main.data[i - 1];
               else
                   d1 = main.data[i];
               d = (x0 - d0.date > d1.date - x0) ? d1 : d0;

               if ((i == 8) && flag)
                   return false;

               if (i == 7) {
                   if (Math.abs(x(main.data[i].date) - pointX) < Math.abs(pointX - x(main.data[i - 1].date))) {
                       d = main.data[i];
                   }
               }

               if (i == 1) {
                   i = 2;
                   d = main.data[1];
               }

               if (!flag) {
                   d = main.data[7];
               }

               if (!flag) {
                   main.focus.transition()
                       .attr("transform", "translate(" + x(d.date) + "," + y(d.amount) + ")")
                       .ease("cubicInOut")
                       .duration(1500)
                       .attrTween("transform", main.translateAlongGrey(main.svg.select("#line2")[0][0]));

                   main.inner_circle
                       .attr("transform", function() {
                           return "translate(" + x(d.date) + "," + (y(d.avg)) + ")";
                       })
                       .transition()
                       .duration(1500)
                       .ease("cubicInOut")
                       .attrTween("transform", main.translateAlong(main.svg.select("#line2")[0][0]));

                   main.svg.select(".tip_axis")
                       .transition()
                       .attr("transform", "translate(" + x(d.date) + ")")
                       .ease("cubicInOut")
                       .duration(function() {
                           if (!flag)
                               return 1500;
                           else
                               return 0;
                       })
                       .attrTween("transform", main.translateAlongAxis(main.svg.select("#line2")[0][0]))
                       .each('end', function() {
                           if (d.date == main.data[7].date)
                               i = 8;

                           main.fadeTooltip(i, true);
                       });
               } else {
                   main.focus.transition()
                       .duration(0)
                       .attr("transform", "translate(" + x(d.date) + "," + y(d.amount) + ")");

                   main.svg.select(".avg_circle").transition()
                       .duration(0)
                       .attr("transform", function() {
                           return "translate(" + x(d.date) + "," + (y(d.avg)) + ")";
                       });

                   main.svg.select(".tip_axis")
                       .transition()
                       .duration(0)
                       .attr("transform", "translate(" + x(d.date) + ")")
                       .each('end', function() {
                           if (d.date == main.data[7].date)
                               i = 8;

                           main.fadeTooltip(i, false);
                       });
               }

           }

           main.translateAlong = function(path) {
               var i = 0;
               var l = path.getTotalLength();
               return function(d, i, a) {
                   return function(t) {
                       t = d3.easeCubicInOut(t);
                       var p = path.getPointAtLength(t * l);
                       if (p.x > x(main.data[7].date))
                           return "translate(" + x(main.data[7].date) + "," + y(main.data[7].avg) + ")";
                       else
                           return "translate(" + p.x + "," + (p.y) + ")";
                   };
               };
           }

           main.translateAlongAxis = function(path) {
               var l = path.getTotalLength();
               return function(d, i, a) {
                   return function(t) {
                       t = d3.easeCubicInOut(t);
                       var p = path.getPointAtLength(t * l);
                       if (p.x > x(main.data[7].date))
                           return "translate(" + x(main.data[7].date) + ")";
                       else
                           return "translate(" + p.x + ")";
                   };
               };
           }

           main.translateAlongGrey = function(path) {
               var l = path.getTotalLength();
               return function(d, i, a) {
                   return function(t) {
                       t = d3.easeCubicInOut(t);
                       var p = path.getPointAtLength(t * l);
                       if (p.x > x(main.data[7].date))
                           return "translate(" + x(main.data[7].date) + "," + y(main.data[7].avg) + ")";
                       else
                           return "translate(" + p.x + "," + (main.getYPoint(p.x)) + ")";
                   };
               };
           }

           main.getYPoint = function(pointX) {
               for (var i = 0; i < main.data.length - 1; i++) {
                   if (pointX >= x(main.data[i].date) && pointX < x(main.data[i + 1].date)) {
                       var pointY = ((y(main.data[i + 1].amount) - y(main.data[i].amount))) / (x(main.data[i + 1].date) - x(main.data[i].date)) * (pointX - x(main.data[i].date)) + y(main.data[i].amount);
                       return pointY
                   }
               }
               return y(main.data[7].amount);

               // if (pointX == x(main.data[0].date))
               // 	return y(main.data[0].amount);
               // var pointY = ((y(main.data[7].amount) - y(main.data[0].amount))) / (x(main.data[7].date) - x(main.data[0].date)) * (pointX - x(main.data[0].date)) + y(main.data[0].amount);
               // return pointY
           }

           main.fadeTooltip = function(i, delay) {
               var fontsize = parseFloat(28 * ratio) + "px";
               $(".tooltip").css("display", "none");

               var html = "<span class='tooltipTitle' style='font-size: " + fontsize + "'>" + "星期" + formatDay(i) + "</span><br/>";
               html += "<span class='tooltipSub' style='font-size: " + fontsize + "'>" + "累计 " + "</span> <span class='tooltipData' style='font-size: " + fontsize + "'>" + main.data[i - 1].avg + "</span> 经验 <span class='arrow_mark'></span>";

               $(".tooltip").html(html);
               var left = main.svg.select(".tip_axis").position().left - $(".tooltip").outerWidth() / 2;
               var arrow_left = 0;
               if (left + $(".tooltip").outerWidth() > $(".sub_main").width() * 0.97 - 8) {
                   left = $(".sub_main").width() * 0.97 - $(".tooltip").outerWidth() - 8;
                   arrow_left = main.svg.select(".tip_axis").position().left - left - $(".tooltip").outerWidth() / 2;
                   $(".tooltip .arrow_mark").css("left", "calc(50% + " + (parseFloat(arrow_left) - 1) + "px)");
               } else {
                   $(".tooltip .arrow_mark").css("left", "calc(50% - 1px)");
               }

               if (delay) {
                   $(".tooltip").fadeOut(20).animate({
                       "left": left + "px",
                   }).fadeIn(30).animate({
                       "display": "block",
                       "opacity": 1
                   });
               } else {
                   $(".tooltip").css({
                       "display": "block",
                       "left": left + "px"
                   });
               }
           }

           main.init(domID);
       }
       var circleAnimation = function() {
           var main = this;

           main.width = $(".circle_chart_area").width();
           main.height = $(".circle_chart_area").width();

           main.radius = (main.width - 16) / 2;

           main.init = function() {
               // d3.select("#circleView svg").remove();
               d3.select(".circle_chart").html("");
               main.svg = d3.select(".circle_chart")
                   .attr("width", main.width)
                   .attr("height", main.height);

               main.arc = d3.svg.arc()
                   .innerRadius(main.radius)
                   .outerRadius((main.radius + 8));

               main.g = main.svg.append("g")
                   .attr("transform", "translate(" + main.width / 2 + "," + main.height / 2 + ")");

               main.background = main.g.append("path")
                   .style("fill", "rgba(0, 0, 0, 0.1)")
                   .datum({
                       startAngle: 0,
                       endAngle: 2 * Math.PI
                   })
                   .attr("d", main.arc);
           }

           main.animation = function() {
               main.background.style("fill", "rgba(255, 155, 0, 0)")
               main.background.transition()
                   .duration(300)
                   .ease("linear")
                   .style("fill", "rgba(255, 155, 0, 1)");
           }

           main.init();
       }
       var arcAnimation = function() {
           var main = this;

           main.width = $(".circle_chart_area").width();
           main.height = $(".circle_chart_area").width();

           main.radius = (main.width - 16) / 2;

           main.color = "rgb(240, 240, 240)";

           main.init = function() {
               d3.select(".arc_chart").html("");
               main.svg = d3.select(".arc_chart")
                   .attr("width", main.width)
                   .attr("height", main.height);

               main.arc = d3.svg.arc()
                   .innerRadius(main.radius)
                   .outerRadius((main.radius + 8));

               main.g = main.svg.append("g")
                   .attr("transform", "translate(" + main.width / 2 + "," + main.height / 2 + ")");

               var background = main.g.append("path")
                   .style("fill", "rgba(0, 0, 0, 0.1)")
                   .datum({
                       startAngle: 0,
                       endAngle: 2 * Math.PI
                   })
                   .attr("d", main.arc);
           }

           main.greyGreen = function(processing) {
               main.arc.cornerRadius(8);
               var whitebackground = main.g.append("path")
                   .style("fill", "rgb(255, 255, 255)")
                   .datum({
                       startAngle: 0,
                       endAngle: 0
                   })
                   .attr("d", main.arc);

               main.color = "rgba(0, 0, 0, 0)";

               main.foreground = main.g.append("path")
                   .attr("class", "foreground")
                   .style("fill", main.color)
                   .datum({
                       startAngle: 0,
                       endAngle: 0
                   })
                   .attr("d", main.arc);
               main.foreground
                   .datum({
                       startAngle: 0,
                       endAngle: 2 * Math.PI
                   })
                   .attr("d", main.arc);
               main.green(processing);
           }

           main.green = function(processing) {
               var whiteground = main.g.append("path")
                   .style("fill", "rgb(255, 255, 255)")
                   .datum({
                       startAngle: -0.1,
                       endAngle: -0.1
                   })
                   .attr("d", main.arc);

               var greenground = main.g.append("path")
                   .style("fill", "rgb(120, 200, 0)")
                   .datum({
                       startAngle: 0,
                       endAngle: 0
                   })
                   .attr("d", main.arc);

               whiteground.transition()
                   .duration(200)
                   .ease(d3.easeCubicInOut)
                   .attrTween("d", main.arcTween(processing * 2 * Math.PI + 0.1));

               greenground.transition()
                   .duration(200)
                   .ease(d3.easeCubicInOut)
                   .attrTween("d", main.arcTween(processing * 2 * Math.PI));
           }

           main.arcTween = function(newAngle) {
               return function(d) {
                   var interpolate = d3.interpolate(d.endAngle, newAngle);
                   return function(t) {
                       d.endAngle = interpolate(t);
                       return main.arc(d);
                   }
               }
           }

           main.init();
       }

       $(window).scroll(function(event) {
           event.stopPropagation();
           event.preventDefault();
           parallex();

           if (isScrolledIntoView('#line_chart_area') && !lineView) {
               lineView = true;
               var data = {
                   date: [1, 2, 3, 4, 5, 6, 7, 8],
                   amount: daily_xp_goal,
                   avg: actual_xp
               }
               var lineanimation = new lineAnimation("line_chart_area", data);
           }

           if ($('.statistic_description').length && isScrolledIntoView('.statistic_description') && !labelView) {
               labelView = true;

               $(".statistic_description .sum_label.animation_label").addClass("text_animate");
               $(".statistic_description .animation_black_label").addClass("text_animate_non_padding");

               $(".probability_description #noninclude_img").addClass("text_animate_medium_padding");

               $(".probability_description #include_img").addClass("text_animate_small_padding");
               // setTimeout(noteViewAnimation, 900);
           }

           if (isScrolledIntoView(".part_3") && !noteView) {
               noteViewAnimation();
           }

           if (isScrolledIntoView("#circleView") && !circleView) {
               var circleIndex = 1;
               var opacity = 0.1;
               circleView = true;

               var flame_animation_flg = false;
               if (longest_streak != 0) {
                   var circleInterval = setInterval(function() {
                       if (circleIndex > 0) {
                           if (!flame_animation_flg && flame_animation) {
                               flame_animation.play();
                               flame_animation_flg = true;
                           }
                       }
                       if (circleIndex > longest_streak - 1) {
                           clearInterval(circleInterval);
                           circleEnd = true;
                           circleChart.animation();
                           donutAnimation();
                           $(".second_section .circle_div p").html(longest_streak);
                           return;
                       }
                       $(".second_section .circle_div p").html(circleIndex);
                       circleIndex += 2;
                   }, 2);
               } else {
                   circleEnd = true;
                   $("#flame_animation").html("");
               }
           }

           if (isScrolledIntoView("#donutView") && !donutView) {
               var current_course_progress_int = parseInt(current_course_progress * 1000);
               if (circleEnd) {
                   var donutIndex = 0;
                   donutView = true;
                   var step_val = current_course_progress_int / 1000;
                   var step = 0;
                   var donutInterval = setInterval(function() {
                       if (step_val * step != Math.round(step_val * step))
                           $(".en_progress_section .circle_div p").html((step_val * step).toFixed(1) + '%');
                       else
                           $(".en_progress_section .circle_div p").html((step_val * step) + '%');
                       if (step >= 100) {
                           clearInterval(donutInterval);
                           donutChart.greyGreen(current_course_progress);
                       }
                       step++;
                   }, 10);
               }
           }

           if (isScrolledEndView(".sequence_date") && !countView) {
               countView = true;
               countday = 1;
               counterAnimatorElement = document.getElementsByClassName("data_counter")[0];
               var countdayInterval = setInterval(function() {
                   if (countday >= days_since_joined - 1) {
                       counterAnimatorElement.innerHTML = days_since_joined;
                       clearInterval(countdayInterval);
                       $(".last_section").addClass("dotAnimation");
                       return;
                   }
                   counterAnimatorElement.innerHTML = countday;
                   countday += 2;
               }, 1);
           }
       })

       function noteViewAnimation() {
           if (noteView)
               return;
           noteView = true;
           // var top = parseFloat($(".note").css("top"), 10);
           // $(".bubble").css({
           //        "opacity": 0,
           //        "margin-top": "20px"
           //    }, {
           //        easing: "easeInOut"
           //    }).fadeIn(800).animate({
           //        "opacity": 1,
           //        "margin-top": "0px"
           //    });

           //    $(".bubble_speech").css({
           //        "opacity": 0,
           //        "margin-top": "40px"
           //    }, {
           //        easing: "easeInOut"
           //    }).fadeIn(800).animate({
           //        "opacity": 1,
           //        "margin-top": "0px"
           //    });

           $(".part_3 .col-xs-2 img").css({
               "opacity": 0
           }, {
               easing: "easeInOut"
           }).fadeIn(500).animate({
               "opacity": 1
           });

           $(".part_3 .col-xs-10 .note").css({
               "opacity": 0
           }, {
               easing: "easeInOut"
           }).fadeIn(500).animate({
               "opacity": 1
           });
       }

       function donutAnimation() {
           if (isScrolledIntoView("#donutView") && !donutView) {
               var donutIndex = 0;
               donutView = true;
               var current_course_progress_int = parseInt(current_course_progress * 1000);
               var step_val = current_course_progress_int / 1000;
               var step = 0;
               var donutInterval = setInterval(function() {
                   if (step_val * step != Math.round(step_val * step))
                       $(".en_progress_section .circle_div p").html((step_val * step).toFixed(1) + '%');
                   else
                       $(".en_progress_section .circle_div p").html((step_val * step) + '%');
                   if (step >= 100) {
                       clearInterval(donutInterval);
                       donutChart.greyGreen(current_course_progress);
                   }
                   step++;
               }, 10);
           }
       }

       function scrollDirection() {
           var dir;
           if (document.body.getBoundingClientRect().top > scrollPos) {
               dir = 'up';
               scrollDelta = parseFloat(document.body.getBoundingClientRect().top) - parseFloat(scrollPos);
           } else {

               dir = 'down';
               scrollDelta = parseFloat(scrollPos) - parseFloat(document.body.getBoundingClientRect().top);
           }
           scrollPos = document.body.getBoundingClientRect().top;

           return dir;
       }

       function parallex() {

           direction = scrollDirection();
           if ($(window).scrollTop() > $(".pages").height() * 0.6) {
               $(".main").css("top", "0px");
               return;
           }
           if ($(window).scrollTop() < 0) {
               $(".main").css("top", $(".pages").height() * 0.09363);
               return;
           } else if ($(window).height() - parseFloat(document.body.getBoundingClientRect().top) > ($("#pages").height() - parseFloat($(".main").css("top")))) {
               $(".main").css("top", "0px");
               return;
           }

           if (direction == "down") {
               if (parseFloat($(".main").css("top")) > parseFloat(scrollDelta) * 0.5)
                   $(".main").css("top", (parseFloat($(".main").css("top")) - scrollDelta * 0.5) + "px");
               else
                   $(".main").css("top", "0px");
           } else if (direction == "up") {
               if (parseFloat($(".main").css("top")) + parseFloat(scrollDelta) * 0.5 < $(".pages").height() * 0.09363) {
                   $(".main").css("top", (parseFloat($(".main").css("top")) + parseFloat(scrollDelta) * 0.5) + "px");
               } else {
                   $(".main").css("top", $(".pages").height() * 0.09363);
               }
           }
       }

       $(document).on("touchstart", "body", function(e) {
           var date = new Date();
           startScrollStamp = date.getTime();
       })

       $.fn.extend({
           disableSelection: function() {
               this.each(function() {
                   this.onselectstart = function() {
                       return false;
                   };
                   this.unselectable = "on";
                   $(this).css('-moz-user-select', 'none');
                   $(this).css('-webkit-user-select', 'none');
               });
           }
       });

       $(function() {
           $(this).disableSelection();
       });
       var def_width = 750,
           def_font_size1 = 112,
           def_font_size2 = 32,
           def_font_size3 = 48,
           def_font_size4 = 56,
           def_font_size5 = 40,
           def_font_size6 = 36,
           def_panel_height = 434,
           def_panel_top = 255,
           def_dlg_height = 285;

       var share_title_font = 50,
           share_desc_font = 38,
           share_confirm_font = 34,
           share_title_height = 68,
           share_desc_height = 53.2;

       var font_size1 = 0,
           font_size2 = 0,
           font_size3 = 0,
           font_size4 = 0,
           font_size5 = 0,
           font_size6 = 0;

       var const_height = 4272;

       var default_bar_thick = 10,
           default_top = 28,
           default_handle_size = 65;
       var bar_thick = 0,
           top_size = 0,
           handle_size = 0,
           shadow_size = 0;

       var ratio = 0;

       var tooltipSize = 28;

       var windowWidth = 0;

       var barView = false,
           lineView = false,
           circleView = false,
           donutView = false,
           noteView = false,
           circleEnd = false,
           countView = false,
           labelView = false,
           lineTooltipShow = false;

       var flame_animation = null;

       var counterAnimatorElement = null;
       counterAnimator = null,
           countday = 1;

       var barChart, lineChart, circleChart, donutChart;

       var scrollPos = 0,
           scrollDelta = 0,
           direction = '';

       // var org_data = [1200, 0, 1920, 2000, 1920];
       var data = [];
       var timeoutId;
       for (var i = 0; i < weekly_progress.length; i++) {
           data.push({
               "Info": i,
               "Value": weekly_progress[i]
           });
       }

       var share_bottom_default_height = 424;

       var startScrollStamp = 0;

       window.onload = function() {
           var url = window.location.href
           paths = url.split('/')
           console.log(paths)
           report_date = paths[4]
           report_uuid = paths[5].split('.')[0];
           console.log(report_date, report_uuid)
           $.ajax({
               url: "https://wechat-backend-api-prod.duolingo.cn/pageload/" + report_date + '/' + report_uuid,
               type: "POST",
               contentType: "application/json",
               dataType: "json",
               success: function(result, xhr) {
                   console.log(result)
               },
               error: function(xhr) {
                   console.log(xhr);
               }
           })
           init();
           $("#mask").fadeIn(100).animate({
               "opacity": 0,
               "z-index": -1
           }, function() {

               barChart = new barAnimation("bar_chart_area", data);

               circleChart = new circleAnimation();
               $("#flame_animation").html("");
               if (longest_streak != 0)
                   flame_animation = lottie.loadAnimation({
                       container: document.getElementById('flame_animation'), // Required
                       path: '../js/data/Juicy_Streak_Flame_15.json', // Required
                       renderer: 'svg', // Required
                       loop: false, // Optional
                       autoplay: false
                   });
               donutChart = new arcAnimation();

               windowWidth = $(window).width();
           })
       };

       function isScrolledIntoView(elem) {
           var docViewTop = $(window).scrollTop();
           var docViewBottom = docViewTop + $(window).height();

           var elemTop = $(elem).offset().top;
           var elemBottom = elemTop + $(elem).height();

           return ((elemTop <= docViewBottom - 200) && (elemBottom >= docViewTop));
       }

       function isScrolledEndView(elem) {
           var docViewTop = $(window).scrollTop();
           var docViewBottom = docViewTop + $(window).height();

           var elemTop = $(elem).offset().top;
           var elemBottom = elemTop + $(elem).height();

           return ((elemTop <= docViewBottom) && (elemBottom >= docViewTop));
       }

       /*********************Detect end of resize event**************************************/
       var rtime;
       var timeout = false;
       var delta = 500;

       $(window).resize(function() {
           rtime = new Date();
           if (timeout === false) {
               timeout = true;
               setTimeout(resizeEnd, delta);
           }
       })

       function resizeEnd() {
           if (new Date() - rtime < delta) {
               setTimeout(resizeEnd, delta);
           } else {
               timeout = false;
               if (Math.abs($(window).width() - windowWidth) < 5) {
                   return false;
               } else {
                   $(window).scrollTop(0);
                   $(".barTooltip").hide();
                   $(".tooltip").hide();
                   init();
                   $(".main").css("top", $("#pages").height() * 0.09363);
                   barChart = new barAnimation("bar_chart_area", data);
                   circleChart = new circleAnimation("");
                   $("#flame_animation").html("");
                   flame_animation = lottie.loadAnimation({
                       container: document.getElementById('flame_animation'), // Required
                       path: '../js/data/Juicy_Streak_Flame_15.json', // Required
                       renderer: 'svg', // Required
                       loop: false, // Optional
                       autoplay: false
                   });
                   donutChart = new arcAnimation();

                   $("#flame_animation").html("");

                   windowWidth = $(window).width();
               }
           }
       }

       /**************************************************************************************/

       function init() {
           barView = false;
           lineView = false;
           circleView = false;
           donutView = false;
           noteView = false;
           lineTooltipShow = false;

           counterAnimator = null;

           ratio = parseFloat(parseFloat($(window).width()) / parseFloat(def_width));
           font_size1 = parseFloat(parseFloat(def_font_size1) * ratio);
           font_size2 = parseFloat(parseFloat(def_font_size2) * ratio);
           font_size3 = parseFloat(parseFloat(def_font_size3) * ratio);
           font_size4 = parseFloat(parseFloat(def_font_size4) * ratio);
           font_size5 = parseFloat(parseFloat(def_font_size5) * ratio);
           font_size6 = parseFloat(parseFloat(def_font_size6) * ratio);

           tooltipSize = parseFloat(28 * ratio);

           $("h2").css('font-size', font_size1 + 'px');
           $("h5").css('font-size', font_size2 + 'px');
           $("p").css('font-size', font_size3 + 'px');
           $(".chart_description p").css('font-size', font_size2 + 'px');
           $(".chart_description p span").css('font-size', font_size2 + 'px');
           $(".chart_description p").css('line-height', font_size4 + 'px');

           $(".statistic_description p").css('font-size', font_size2 + 'px');
           $(".statistic_description p").css('line-height', font_size3 + 'px');
           $(".statistic_description p.sum_label").css('font-size', font_size4 + 'px');
           $(".statistic_description p.sum_label").css('line-height', (font_size2 * 2) + 'px');
           $(".statistic_description p span").css('font-size', font_size2 + 'px');
           $(".statistic_description p span").css('line-height', font_size3 + 'px');

           $(".probability_description p").css('font-size', font_size2 + 'px');
           $(".probability_description .sum_label").css('font-size', font_size4 + 'px');
           $(".probability_description p.sum_label").css('line-height', (font_size2 * 2) + 'px');
           $(".probability_description p.sum_label span").css('line-height', font_size4 + 'px');
           $(".probability_description .sum_label span").css('font-size', font_size4 + 'px');

           $(".note p").css('font-size', font_size5 + 'px');
           $(".note p.ch_note").css('font-size', (parseFloat(28 * ratio)) + 'px');
           $(".note p.ch_note span").css('font-size', (parseFloat(28 * ratio)) + 'px');

           $(".sum_label_0").css('font-size', (parseFloat(30 * ratio)) + 'px');
           $(".sum_label_1").css('font-size', (parseFloat(30 * ratio)) + 'px');
           $(".sum_label_0").css('line-height', font_size3 + 'px');
           $(".sum_label_1").css('line-height', font_size3 + 'px');
           $(".sum_label_3").css('font-size', (parseFloat(30 * ratio)) + 'px');
           $(".lessons_description p span").css('font-size', (parseFloat(30 * ratio)) + 'px');
           $(".lessons_description p span").css('line-height', font_size3 + 'px');
           $(".statistic_description p span").css('font-size', (parseFloat(30 * ratio)) + 'px');
           $(".statistic_description p span").css('line-height', font_size3 + 'px');

           $(".note p").css('line-height', font_size3 + 'px');

           $("p.subTitle").css('font-size', font_size2 + 'px');
           $("p.date").css('font-size', font_size2 + 'px');
           $("p.date").css('line-height', font_size3 + 'px');
           $("p.date span").css('font-size', font_size2 + 'px');

           $("p.sequence_date").css('font-size', font_size3 + 'px');
           $("p.sequence_date span").css('font-size', font_size3 + 'px');

           $("p.notification").css('font-size', font_size6 + 'px');

           $(".barTooltip").css("font-size", parseFloat(28 * ratio) + 'px');
           $(".barTooltip").css("line-height", parseFloat(44 * ratio) + 'px');

           $(".tooltip").css("font-size", parseFloat(28 * ratio) + 'px');
           $(".tooltip").css("line-height", parseFloat(44 * ratio) + 'px');

           $("span.tooltipTitle").css('font-size', parseFloat(28 * ratio) + 'px');
           $("span.tooltipData").css('font-size', parseFloat(28 * ratio) + 'px');
           $("span.tooltipSub").css('font-size', parseFloat(28 * ratio) + 'px');

           $(".fa-arrow-up").css('font-size', parseFloat(font_size4) + 'px');
           $(".share_title").css('font-size', parseFloat(share_title_font * ratio) + 'px');
           $(".share_desc").css('font-size', parseFloat(share_desc_font * ratio) + 'px');
           $(".share_confirm").css('font-size', parseFloat(share_confirm_font * ratio) + 'px');

           $(".share_title").css('line-height', parseFloat(share_title_height * ratio) + 'px');
           $(".share_desc").css('line-height', parseFloat(share_desc_height * ratio) + 'px');

           $("button").css('font-size', font_size2 + 'px');
           var body_height = Math.round(parseFloat($(window).width()) * parseFloat(const_height) / 750);
           $("#pages").height(body_height + "px");

           $(".mask_animation").height($("#animation_img").height());
           $(".mask_animation").css("min-height", "150px");

           // $(".share_bottom").css("height", (share_bottom_default_height * ratio) + "px");

           $(".arrow_contain").css("height", $(".mask_share").height() - $(".share_bottom").height());
           $(".circle_chart_area").css("height", $(".circle_chart_area").css("width"));
           $('body').css('visibility', 'visible');
       }

       $(document).ready(function() {

           if (weekly_progress[weekly_progress.length - 2] <= 0) {
               $(".chart_description .first_bar").html("100%");
           } else if (weekly_progress[weekly_progress.length - 2] > 0) {
               var weekly_length = weekly_progress.length;
               var percent = 0;
               if (weekly_progress[weekly_length - 1] > weekly_progress[weekly_length - 2]) {
                   percent = Math.round((weekly_progress[weekly_length - 1] / weekly_progress[weekly_length - 2] - 1) * 100);
               } else if (weekly_progress[weekly_length - 1] < weekly_progress[weekly_length - 2]) {
                   percent = Math.round((1 - weekly_progress[weekly_length - 1] / weekly_progress[weekly_length - 2]) * 100);
               }
               $(".chart_description .first_bar").html(percent + "%");
           }

           var check_only_one_week = false;

           for (var i = 0; i < weekly_progress.length - 1; i++) {
               if (weekly_progress[i] != -1) {
                   check_only_one_week = true;
                   break;
               }
           }

           if (!check_only_one_week) {
               $(".bar_chart_desc p").html(`学习经验值超过了全国 ` + `<span class="dinFont_bold">` + parseInt(rank_in_country * 100) + `%</span> ` + `的学习者`);
           }

           var check_new_user = false;

           for (var i = 0; i < weekly_progress.length - 2; i++) {
               if (weekly_progress[i] != -1) {
                   check_new_user = true;
                   break;
               }
           }

           if (!check_new_user) {
               for (var i = weekly_progress.length - 2; i < weekly_progress.length; i++) {
                   if (weekly_progress[i] != 0) {
                       check_new_user = true;
                       break;
                   }
               }
           }

           if (!check_new_user) {
               $(".bar_chart_desc p").html("过去一周没有完成任何学习");
               $(".logo img").attr("src", "../css/img/duo_new.svg");
           } else if (actual_xp[7] > daily_xp_goal[7] && actual_xp[7] < daily_xp_goal[7] * 2) {
               $(".logo img").attr("src", "../css/img/duo_larger_XP.svg");
           } else if (actual_xp[7] >= daily_xp_goal[7] * 2) {
               $(".logo img").attr("src", "../css/img/duo_2_larger_XP.svg");
           } else if (actual_xp[7] == daily_xp_goal[7]) {
               $(".logo img").attr("src", "../css/img/duo_equal_XP.svg");
           } else
               $(".logo img").attr("src", "../css/img/duo_less_XP.svg");

           if (actual_xp[7] == 0) {
               $(".line_chart_desc p").html(`过去一周没有完成任何学习`);
           } else if (actual_xp[7] > daily_xp_goal[7]) {
               var high_rate = parseInt((actual_xp[7] - daily_xp_goal[7]) / daily_xp_goal[7] * 100);
               $(".line_chart_desc p").html(`过去一周学习经验值高于目标 ` + `<span>` + high_rate + `%</span><br/>` + `本周继续努力！`);
           } else if (actual_xp[7] == daily_xp_goal[7]) {
               $(".line_chart_desc p").html(`过去一周学习经验值达到了目标` + `<br/>` + `本周继续努力！`);
           } else if (actual_xp[7] < daily_xp_goal[7]) {
               var high_rate = parseInt((-actual_xp[7] + daily_xp_goal[7]) / daily_xp_goal[7] * 100);
               $(".line_chart_desc p").html(`过去一周学习经验值低于目标 ` + `<span>` + high_rate + `%</span><br/>` + `本周要加油哦！`);
           }

           if (actual_xp[7] <= daily_xp_goal[7]) {

               if (weekly_progress[weekly_progress.length - 1] < weekly_progress[weekly_progress.length - 2] && weekly_progress[weekly_progress.length - 1] != 0) {
                   $("#bar_chart_area").css("top", "17.6%");
                   $(".bar_chart_desc").css("top", "27.6%");
               } else {
                   $("#bar_chart_area").css("top", "18.1%");
                   $(".bar_chart_desc").css("top", "29.1%");
               }
           }

           if ((actual_xp[7] > daily_xp_goal[7] && actual_xp[7] < daily_xp_goal[7] * 2)) {
               if (weekly_progress[weekly_progress.length - 1] < weekly_progress[weekly_progress.length - 2] && weekly_progress[weekly_progress.length - 1] != 0) {
                   $("#bar_chart_area").css("top", "17.6%");
                   $(".bar_chart_desc").css("top", "27.6%");
               } else {
                   $("#bar_chart_area").css("top", "18.1%");
                   $(".bar_chart_desc").css("top", "29.1%");
               }
           }

           if (actual_xp[7] == 0) {
               $(".line_chart_desc").css("top", "59.5%");
               $(".statistic_description").css("top", "63.8%");
               $(".probability_description").css("top", "73.5%");
               $(".hr_2").css("top", "80%");
               // $(".note").css("top", "83.9%");
               $(".part_3").css({
                   "top": "81.5%",
                   "height": "18.7%"
               });
               if (!check_new_user) {
                   console.log('ccc');
                   $(".statistic_description").css("top", "64%");
                   $(".probability_description").css("top", "71%");
                   $(".bar_chart_desc").css("top", "29.1%");
                   $(".hr_2").css("top", "77.5%");
                   // $(".note").css("top", "82.5%");
                   $(".part_3").css({
                       "top": "79%",
                       "height": "21.2%"
                   })
               }
           }

           $("#share").click(function() {
               $(".mask_share").addClass("share_active");
               $(".mask_share").show();
           })

           $(".share_bottom a").click(function() {
               $(".mask_share").hide();
               $(".mask_share").removeClass("share_active");
           })

           $(".mask_share").on("touchmove", function(e) {
               e.stopPropagation();
               e.preventDefault();
           });
       })