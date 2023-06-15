function bin(num, len=0, sep=0) { 
    let res = (num).toString(2).split("");
    if (len && len > res.length) { res = "0".repeat(len - res.length).split("").concat(res); }
    if (sep) { res = res.map((item, index) => ((res.length - index) % sep) ? item : " " + item)}
    return res.join("").trim();
}

// ------------------- Move ------------------------------------------------------------------------------------------------------------------
/*
    0000 0000 0011 1111    source
    0000 1111 1100 0000    target
    xxxx 0000 0000 0000    
     ||
    0000 = quiet
    0001 = double pawn push
    0010 = kingside castle
    0011 = queenside castle
    0100 = capture
    0101 = enpassant
    0110 = ?
    0111 = ?
    1000 = knight promote
    1001 = bishop promote
    1010 = rook promote
    1011 = queen promote
    1100 = knight promote capture
    1101 = bishop promote capture
    1110 = rook promote capture
    1111 = queen promote
*/
function create_move(source, target, flag=0) { return (flag << 12) | (target << 6) | source; }
function get_move_source(move) { return move & 0b111111; }
function get_move_target(move) { return (move & 0b111111000000) >> 6; }
function get_move_flag(move) { return (move & 0b111100000000000000) >> 12; }

function print_move(move) { console.log(get_move_source(move), get_move_target(move), get_move_flag(move)); }
function display_move(move) { console.log(bin(move, 16, 4)); }

// ------------------- Castle ------------------------------------------------------------------------------------------------------------------
/*
    0000 = no castle
    0001 = white kingside
    0010 = white queenside
    0100 = black kingside
    1000 = black queenside
*/
function create_castle(castle_str="KQkq") {
    let res = 0;
    let lookup = "KQkq";
    for (let x of castle_str) { res |= 1 << lookup.indexOf(x); }
    return res;
}
function get_castle_wk(castle) { return castle & 0b1; }
function get_castle_wq(castle) { return (castle & 0b10) >> 1; }
function get_castle_bk(castle) { return (castle & 0b100) >> 2; }
function get_castle_bq(castle) { return (castle & 0b1000) >> 3; }
  
function update_castle(castle, move) {
    let update = [
         7, 15, 15, 15,  3, 15, 15, 11,
        15, 15, 15, 15, 15, 15, 15, 15,
        15, 15, 15, 15, 15, 15, 15, 15,
        15, 15, 15, 15, 15, 15, 15, 15,
        15, 15, 15, 15, 15, 15, 15, 15, 
        15, 15, 15, 15, 15, 15, 15, 15,
        15, 15, 15, 15, 15, 15, 15, 15,
        13, 15, 15, 15, 12, 15, 15, 14
    ];
    let source = get_move_source(move);
    let target = get_move_target(move);
    castle &= update[source];
    castle &= update[target];
    return castle;
}
function print_castle(castle) { 
    let res = "";
    let lookup = "KQkq";
    for (let i = 0; i < 4; i++) {
        res += castle & (1 << i) ? lookup[i] : "";
    }
    console.log(res);
}     
function display_castle(castle) { console.log(bin(castle, 4)); }

// ------------------- b ------------------------------------------------------------------------------------------------------------------
/*
    List of 2 32-bit numbers representing board, top left to bottom right
    0 1 2 ....
    ....  ....
    .... 62 63
*/
function and(b1, b2) { return [b1[0] & b2[0], b1[1] & b2[1]]; }
function or(b1, b2) { return [b1[0] | b2[0], b1[1] | b2[1]]; }
function xor(b1, b2) { return [b1[0] ^ b2[0], b1[1] ^ b2[1]]; }
function nand(b1, b2) { return [b1[0] & ~b2[0], b1[1] & ~b2[1]]; }

function get_bit(b, i) {
    if (i < 32) { 
        return b[0] & (1 << i); 
    }
    return b[1] & (1 << i);
}
function set_bit(b, i) {
    if (i < 32) {
        b[0] |= (1 << i);
    } else {
        b[1] |= (1 << i);
    }
}
function pop_bit(b, i) {
    let bit = get_bit(b, i);
    if (bit) {
        if (i < 32) {
            b[0] ^= (1 << i); 
        } else {
            b[1] ^= (1 << i); 
        }
    }
    return bit;
}

function count_bits_number(number) {
	number -= (number >>> 1) & 0x55555555;
	number = (number & 0x33333333) + ((number >>> 2) & 0x33333333);
	return ((number + (number >>> 4) & 0xF0F0F0F) * 0x1010101) >>> 24;
}
function count_bits(b) { return count_bits_number(b[0]) + count_bits_number(b[1]); }

function lsb_index_number(number) { return count_bits_number((number & -number) - 1); }
function lsb_index(b) {
    if (b[0]) {
        return lsb_index_number(b[0]);
    }
    return 32 + lsb_index_number(b[1]);
}
function pop_lsb_index(b) {
    let index;
    if (b[0]) {
        index = lsb_index_number(b[0]);
        b[0] &= b[0] - 1;
    } else {
        index = 32 + lsb_index_number(b[1]);
        b[1] &= b[1] - 1;
    }
    return index;
}

function bool_bitboard(b) { return b[0] || b[1]; }
function copy_bitboard(b) { return [b[0], b[1]]; }
function print_bitboard(b) {
    let res = "";
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            res += get_bit(b, (i << 3) + j) ? "1 " : "0 ";
        }
        res += "\n";
    }
    console.log(res);
}

// ------------------- Board ------------------------------------------------------------------------------------------------------------------
/*
    BOARD       -> 12 piece bitboards for each piece and each side
                -> 3 occupancy bitboards for each side and all pieces
    PIECES      -> list of pieces on squares
    TURN        -> 0 = white, 1 = black
    ENPASSANT   -> possible enpassant move target square  
    CASTLE      -> castling rights

    HASH_LIST
    MOVE_LIST
*/
let PIECE_LETTERS = "-PNBRQKpnbrqk";

let BOARD;
let PIECES;
let TURN;
let ENPASSANT;
let CASTLE;
function create_board(fen) {
    
}
function print_board(board_pieces) { console.log(board_pieces.map((item, index) => index % 8 ? PIECE_LETTERS[item] : "\n" + PIECE_LETTERS[item]).join(" ").trim()); }

// Attack mask? Useful for detecting checks?