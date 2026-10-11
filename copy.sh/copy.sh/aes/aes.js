"use strict";

//  http://en.wikipedia.org/wiki/Rijndael_S-box
var substitution_table = [
   0x63, 0x7C, 0x77, 0x7B, 0xF2, 0x6B, 0x6F, 0xC5, 0x30, 0x01, 0x67, 0x2B, 0xFE, 0xD7, 0xAB, 0x76,
   0xCA, 0x82, 0xC9, 0x7D, 0xFA, 0x59, 0x47, 0xF0, 0xAD, 0xD4, 0xA2, 0xAF, 0x9C, 0xA4, 0x72, 0xC0,
   0xB7, 0xFD, 0x93, 0x26, 0x36, 0x3F, 0xF7, 0xCC, 0x34, 0xA5, 0xE5, 0xF1, 0x71, 0xD8, 0x31, 0x15,
   0x04, 0xC7, 0x23, 0xC3, 0x18, 0x96, 0x05, 0x9A, 0x07, 0x12, 0x80, 0xE2, 0xEB, 0x27, 0xB2, 0x75,
   0x09, 0x83, 0x2C, 0x1A, 0x1B, 0x6E, 0x5A, 0xA0, 0x52, 0x3B, 0xD6, 0xB3, 0x29, 0xE3, 0x2F, 0x84,
   0x53, 0xD1, 0x00, 0xED, 0x20, 0xFC, 0xB1, 0x5B, 0x6A, 0xCB, 0xBE, 0x39, 0x4A, 0x4C, 0x58, 0xCF,
   0xD0, 0xEF, 0xAA, 0xFB, 0x43, 0x4D, 0x33, 0x85, 0x45, 0xF9, 0x02, 0x7F, 0x50, 0x3C, 0x9F, 0xA8,
   0x51, 0xA3, 0x40, 0x8F, 0x92, 0x9D, 0x38, 0xF5, 0xBC, 0xB6, 0xDA, 0x21, 0x10, 0xFF, 0xF3, 0xD2,
   0xCD, 0x0C, 0x13, 0xEC, 0x5F, 0x97, 0x44, 0x17, 0xC4, 0xA7, 0x7E, 0x3D, 0x64, 0x5D, 0x19, 0x73,
   0x60, 0x81, 0x4F, 0xDC, 0x22, 0x2A, 0x90, 0x88, 0x46, 0xEE, 0xB8, 0x14, 0xDE, 0x5E, 0x0B, 0xDB,
   0xE0, 0x32, 0x3A, 0x0A, 0x49, 0x06, 0x24, 0x5C, 0xC2, 0xD3, 0xAC, 0x62, 0x91, 0x95, 0xE4, 0x79,
   0xE7, 0xC8, 0x37, 0x6D, 0x8D, 0xD5, 0x4E, 0xA9, 0x6C, 0x56, 0xF4, 0xEA, 0x65, 0x7A, 0xAE, 0x08,
   0xBA, 0x78, 0x25, 0x2E, 0x1C, 0xA6, 0xB4, 0xC6, 0xE8, 0xDD, 0x74, 0x1F, 0x4B, 0xBD, 0x8B, 0x8A,
   0x70, 0x3E, 0xB5, 0x66, 0x48, 0x03, 0xF6, 0x0E, 0x61, 0x35, 0x57, 0xB9, 0x86, 0xC1, 0x1D, 0x9E,
   0xE1, 0xF8, 0x98, 0x11, 0x69, 0xD9, 0x8E, 0x94, 0x9B, 0x1E, 0x87, 0xE9, 0xCE, 0x55, 0x28, 0xDF,
   0x8C, 0xA1, 0x89, 0x0D, 0xBF, 0xE6, 0x42, 0x68, 0x41, 0x99, 0x2D, 0x0F, 0xB0, 0x54, 0xBB, 0x16
];


function do_log(str)
{
	document.getElementById("result").appendChild(document.createTextNode(str + "\n"));
}

function log_matrix(matrix_array)
{
	var log = "";

	for(var i = 0; i < matrix_array.length; i++)
	{
		log += hex(matrix_array[i]) + " ";

		if(i % 4 === 3)
		{
			do_log(log);
			log = "";
		}
	}

	do_log("\n");
}

function hex(number)
{
	return (number < 16 ? "0" : "") + number.toString(16).toUpperCase();
}

function substitution(matrix)
{
	for(var i = 0; i < 16; i++)
	{
		matrix[i] = substitution_table[matrix[i]];
	}
}

function shift_rows(matrix)
{
	// row 2
	// rotate left by 1
	var tmp = matrix[4];
	matrix[4] = matrix[5];
	matrix[5] = matrix[6];
	matrix[6] = matrix[7];
	matrix[7] = tmp;

	// row 3
	// rotate left by 2
	// = exchange 0 and 2, 1 and 3
	var tmp = matrix[8];
	matrix[8] = matrix[10]
	matrix[10] = tmp;
	var tmp = matrix[9];
	matrix[9] = matrix[11];
	matrix[11] = tmp;

	// row 4
	// rotate left by 3
	// = rotate right by 1
	var tmp = matrix[15];
	matrix[15] = matrix[14];
	matrix[14] = matrix[13];
	matrix[13] = matrix[12];
	matrix[12] = tmp;
}

function mix_columns(matrix)
{
	for(var i = 0; i < 4; i++)
	{
		var column = [matrix[i], matrix[i + 4], matrix[i + 8], matrix[i + 12]],
			multiple_1 = [],
			multiple_2 = [],
			multiple_3 = [];

		// calculate multiples of column
		for(var j = 0; j < 4; j++)
		{
			multiple_1[j] = column[j];
			multiple_2[j] = column[j] << 1;
			
			// if bit 8 is set reduce by P(x) = x^8 + x^4 + x^3 + x + 1 = 0x11B
			if(multiple_2[j] & 0x100)
			{
				multiple_2[j] ^= 0x11B;
			}

			multiple_3[j] = multiple_1[j] ^ multiple_2[j];
		}

		// apply matrix
		column[0] = multiple_2[0] ^ multiple_3[1] ^ multiple_1[2] ^ multiple_1[3];
		column[1] = multiple_1[0] ^ multiple_2[1] ^ multiple_3[2] ^ multiple_1[3];
		column[2] = multiple_1[0] ^ multiple_1[1] ^ multiple_2[2] ^ multiple_3[3];
		column[3] = multiple_3[0] ^ multiple_1[1] ^ multiple_1[2] ^ multiple_2[3];

		matrix[i] = column[0];
		matrix[i + 4] = column[1];
		matrix[i + 8] = column[2];
		matrix[i + 12] = column[3];
	}
}

function add_key(matrix, key)
{
	for(var i = 0; i < 16; i++)
	{
		matrix[i] ^= key[i];
	}
}

function key_schedule(previous_key, c)
{
	var next_key = [];

	// first column

	// rotate column left
	next_key[0] = previous_key[7];
	next_key[4] = previous_key[11];
	next_key[8] = previous_key[15];
	next_key[12] = previous_key[3];

	// substitute
	next_key[0] = substitution_table[next_key[0]];
	next_key[4] = substitution_table[next_key[4]];
	next_key[8] = substitution_table[next_key[8]];
	next_key[12] = substitution_table[next_key[12]];

	// round coefficient
	var rc = 1 << c;

	// if rc bit 9 is set, reduce by P(x) * x
	if(rc & 0x200)
	{
		rc ^= 0x11B << 1;
	}

	// if rc bit 8 is set, reduce by P(x)
	if(rc & 0x100)
	{
		rc ^= 0x11B;
	}
	
	next_key[0] ^= rc;

	// xor "i - 4" values
	for(var i = 0; i < 16; i++)
	{
		next_key[i] ^= previous_key[i];
	}

	// other three columns
	for(var i = 1; i < 4; i++)
	{
		next_key[i] ^= next_key[i - 1];
		next_key[i + 4] ^= next_key[i + 3];
		next_key[i + 8] ^= next_key[i + 7];
		next_key[i + 12] ^= next_key[i  + 11];
	}

	return next_key;
}


function do_encrypt(message, key)
{
	var round_keys = [key],
		key_size = key.length << 3, // in bits
		round_count = 6 + (key_size >> 5),
		start = +new Date;

	for(var i = 0; i < round_count; i++)
	{
		round_keys.push(key_schedule(round_keys[i], i));
	}

	do_log("start values");
	do_log("------------\n");
	do_log("plaintext:");
	log_matrix(message);

	do_log("key:");
	log_matrix(key);

	add_key(message, round_keys[0]);
	do_log("key add:");
	log_matrix(message);

	for(var i = 1; i < round_count + 1; i++)
	{
		do_log("round  " + i);
		do_log("---------\n");

		do_log("round key " + i);
		log_matrix(round_keys[i]);

		substitution(message);

		do_log("after substitution:");
		log_matrix(message);

		shift_rows(message);

		do_log("after shifted rows:");
		log_matrix(message);

		// skip mix columns in last round
		if(i !== round_count)
		{
			mix_columns(message);

			do_log("after mixed columns:");
			log_matrix(message);
		}

		add_key(message, round_keys[i]);

		do_log("after key add:");
		log_matrix(message);
	}


	do_log("result")
	do_log("------\n");
	log_matrix(message);

	do_log("AES-" + key_size);
	do_log("finished in " + ((new Date - start) / 1000) + "s");

}

function str2bytearray(str)
{
	var temp = str.split(" "), result = [], byt;
	
	for(var i = 0; i < temp.length; i++)
	{
		if(temp[i].length === 1)
		{
			temp[i] = "0" + temp[i];
		}
	}

	temp = temp.join("");

	for(var i = 0; i < temp.length; i += 2)
	{
		byt = parseInt(temp[i] + temp[i + 1], 16);

		if(isNaN(byt) || byt < 0 || byt > 0xff)
		{
			return false;
		}

		result.push(byt);
	}

	return result;
	
}

function flip90(array)
{
	var result = [];

	for(var i = 0; i < 4; i++)
	{
		for(var j = 0; j < 4; j++)
		{
			result[i + 4 * j] = array[4 * i + j];
		}
	}

	return result;
}

function random_bytearray()
{
	var result = [];

	for(var i = 0; i < 16; i++)
	{
		result.push(hex(Math.random() * 256 | 0));
	}

	return result.join(" ");
}

window.onload = function()
{
	var submit_button = document.getElementById("encrypt"),
		message_input = document.getElementById("message"),
		key_input = document.getElementById("key"),
		result_field = document.getElementById("result");

	submit_button.onclick = function()
	{
		var message = str2bytearray(message_input.value),
			key = str2bytearray(key_input.value);

		while(result_field.firstChild)
		{
			result_field.removeChild(result_field.firstChild);
		}

		if(message === false)
		{
			do_log("Error: Invalid plain text.");
			return;
		}

		if(key === false)
		{
			do_log("Error: Invalid key.");
			return;
		}

		if(message.length > 16)
		{
			do_log("Error: Plain text too big.");
			return;
		}

		while(message.length < 16)
		{
			message.push(0);
		}

		if(key.length !== 16)
		{
			do_log("Error: Key has to be 16 bytes");
			return;
		}

		do_encrypt(flip90(message), flip90(key));

		result_field.scrollTop = 4e4;
	};

	document.getElementById("example_msg").onclick = function()
	{
		message_input.value = "6D 7E 1C F6 1A 71 19 D9 4E DD 98 C6 64 03 29 BF";
	};

	document.getElementById("random_msg").onclick = function()
	{
		message_input.value = random_bytearray();
	};

	document.getElementById("zero_msg").onclick = function()
	{
		message_input.value = "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00";
	};

	document.getElementById("example_key").onclick = function()
	{
		key_input.value = "E1 21 82 C2 6D E1 21 08 1B CE 76 C1 C3 09 79 3E";
	};

	document.getElementById("random_key").onclick = function()
	{
		key_input.value = random_bytearray();
	};

	document.getElementById("zero_key").onclick = function()
	{
		key_input.value = "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00";
	};
}
