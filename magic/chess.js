function square_index(name) { return name[0].charCodeAt() - (parseInt(name[1]) * 8) - 33; }
function square_name(index) { return String.fromCharCode((index & 7) + 97) + (8 - (index >>> 3)) }
function bin(num, len=0, sep=0) { 
    num >>>= 0;
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
function get_move_target(move) { return (move & 0b111111000000) >>> 6; }
function get_move_flag(move) { return (move & 0b1111000000000000) >>> 12; }
function get_move_promote(move) { return move & 0b1000000000000000 ? ((move & 0b11000000000000) >>> 12) + 1 : 0; }
function get_move_capture(move) { return move & 0b100000000000000; }
function get_move_double(move) { return get_move_flag(move) == 1; }
function get_move_castle(move) { return (get_move_flag(move) & 0b1110) >>> 1 == 1; }
function get_move_enpassant(move) { return get_move_flag(move) == 0b101; }

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
function get_castle_wk(castle) { return castle & 1; }
function get_castle_wq(castle) { return (castle & 2) >>> 1; }
function get_castle_bk(castle) { return (castle & 4) >>> 2; }
function get_castle_bq(castle) { return (castle & 8) >>> 3; }
  
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
function get_castle_letters(castle) { 
    let res = "";
    let lookup = "KQkq";
    for (let i = 0; i < 4; i++) {
        res += castle & (1 << i) ? lookup[i] : "";
    }
    return res;
}
function print_castle(castle) {
    console.log(get_castle_letters(castle));
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
function equal(b1, b2) { return b1[0] == b2[0] && b1[1] == b2[1]; }

function bin_add1(b1, b2, carry=0) {
    return [b1 ^ b2 ^ carry, (b1 & b2) | ((b1 ^ b2) & carry)];
}
function bin_add(n1, n2) {
    let l1 = n1.length;
    let l2 = n2.length;
    if (l1 < l2) { n1 = "0".repeat(l2 - l1 + 1) + n1; n2 = "0" + n2; }
    else { n2 = "0".repeat(l1 - l2 + 1) + n2; n1 = "0" + n1; }

    let n = n1.length;
    n1 = n1.split("").map(item => parseInt(item));
    n2 = n2.split("").map(item => parseInt(item));

    let res = new Array(n).fill(0);
    let carry = 0;
    for (let i = 0; i < n; i++) {
        let j = n - i - 1;
        let x = bin_add1(n1[j], n2[j], carry);
        res[i] = x[0];
        carry = x[1];
    }
    if (!res[n - 1]) { res.pop(); }
    return res.reverse().join("");
}
function bin_mult(n1, n2) {
    let little = n1;
    let big = n2;
    if (n1.length > n2.length) { little = n2; big = n1; }

    let n = little.length;
    let sums = new Array(n);
    for (let i = 0; i < n; i++) {
        sums[i] = little[n - i - 1] == "1" ? big + "0".repeat(i) : "0";
    }
    let res = sums[0];
    for (let i = 1; i < n; i++) {
        res = bin_add(res, sums[i]);
    }
    return "0".repeat(Math.max(0, n - res.length)) + res;
    // if (len && len > res.length) { res = "0".repeat(len - res.length) + res; }
    // if (sep) { res = res.split("").map((item, index) => ((res.length - index) % sep) ? item : " " + item).join("").trim(); }
}
function bin_div(n1, n2) {
    // TODO
}

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
function bin_bitboard(b, sep=0) { return bin(b[1], 32, sep) + " ".repeat(sep ? 1 : 0) + bin(b[0], 32, sep); }
function print_bitboard(b) {
    let res = "";
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            res += get_bit(b, (i * 8) + j) ? "1 " : "0 ";
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
let CASTLE;
let ENPASSANT;
function create_board(fen) {       
    fen = fen.split(" ");
    if (fen.length != 6 || fen[0].split("/").length != 8 || (fen[1] != "w" && fen[1] != "b")) { return []; }

    let r = 0; 
    let c = 0;
    BOARD = new Array(15);
    for (let i = 0; i < 15; i++) {
        BOARD[i] = [0, 0];
    }
    PIECES = new Array(64).fill(0);

    for (let char of fen[0]) {
        if (char == "/") { 
            r++;
            c = 0;
        } else if (!isNaN(char)) { 
            c += parseInt(char);
        } else {
            let i = (r * 8) + c;
            let l = PIECE_LETTERS.indexOf(char);
            set_bit(BOARD[l - 1], i);
            set_bit(BOARD[12 + (l > 6)], i);
            set_bit(BOARD[14], i);
            PIECES[i] = l;
            c++;
        }

    }
    TURN = fen[1] == "b";
    if (fen[2] != "-") { CASTLE = create_castle(fen[2]); }
    else { CASTLE = 0; }
    if (fen[3] != "-") { ENPASSANT = square_index(fen[3]); }
    else { ENPASSANT = 0; }
    // FIFTY = parseInt(fen[4]);
    // MOVE_NUMBER = parseInt(fen[5]);
}
function copy_board(board) { return new Array(15).fill(0).map((item, index) => copy_bitboard(board[index])); }
function print_board(board_pieces) { console.log(board_pieces.map((item, index) => index & 7 ? PIECE_LETTERS[item] : "\n" + PIECE_LETTERS[item]).join(" ").trim()); }
function show_board() { 
    print_board(PIECES);
    console.log(TURN ? "B" : "W", "\t", get_castle_letters(CASTLE), "\t", square_name(ENPASSANT));
}

// DEFINE MOVES ----------------------------------------------------------------------------------------------------------------------

let PAWN_ATTACK;
let KNIGHT_ATTACK;
let KING_ATTACK;
let ROW_MASKS;
let COL_MASKS;
function initialise_constants() { // attack masks for pawns knights kings from any square 
    function set_row_col_mask(row, col) {
        let res = [0, 0];
        if (row >= 0) {
            for (let i = 0; i < 8; i++) {
                set_bit(res, (row * 8) + i);
            }
        } 
        if (col >= 0) {
            for (let i = 0; i < 8; i++) {
                set_bit(res, (i * 8) + col);
            }
        } 
        return res;
    }

    ROW_MASKS = new Array(64); 
    COL_MASKS = new Array(64);
    for (let i = 0; i < 8; i++) {
        let row = set_row_col_mask(i, -1);
        let col = set_row_col_mask(-1, i);
        for (let j = 0; j < 8; j++) {
            ROW_MASKS[(i * 8) + j] = row;
            COL_MASKS[(j * 8) + i] = col;
        }
    }

    function pawn_attack() {
        let res = [new Array(64), new Array(64)];
        for (let i = 0; i < 64; i++) { // player
            let board = [0, 0];           
            let col = i % 8;
            if (8 < i && 0 < col) { set_bit(board, i - 9); }
            if (6 < i && col < 7) { set_bit(board, i - 7); }
            res[0][i] = board;
        }
        for (let i = 0; i < 64; i++) { // ai
            let board = [0, 0]
            let col = i % 8;
            if (i < 57 && 0 < col) { set_bit(board, i + 7); }
            if (i < 55 && col < 7) { set_bit(board, i + 9); }
            res[1][i] = board;
        }
        return res;
    }
    function knight_attack() {
        let res = new Array(64);
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let i = 8 * r + c;
                let board = [0, 0];
                //L 17 15 10 6
                if (16 < i && 1 < r && 0 < c) { set_bit(board, i - 17); }
                if (14 < i && 1 < r && c < 7) { set_bit(board, i - 15); }
                if (9 < i && 0 < r && 1 < c) { set_bit(board, i - 10); }
                if (5 < i && 0 < r && c < 6) { set_bit(board, i - 6); }
                //R 6 10 15 17
                if (i < 58 && r < 7 && 1 < c) { set_bit(board, i + 6); }
                if (i < 54 && r < 7 && c < 6) { set_bit(board, i + 10); }
                if (i < 49 && r < 6 && 0 < c) { set_bit(board, i + 15); }
                if (i < 47 && r < 6 && c < 7) { set_bit(board, i + 17); }

                res[i] = board;
            }
        }
        return res;
    }
    function king_attack() {
        let res = new Array(64);
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let i = 8 * r + c;
                let board = [0, 0];
                //L 9 8 7 1
                if (8 < i && 0 < r && 0 < c) { set_bit(board, i - 9); }
                if (7 < i && 0 < r) { set_bit(board, i - 8); }
                if (6 < i && 0 < r && c < 7) { set_bit(board, i - 7); }
                if (0 < i && 0 < c) { set_bit(board, i - 1); }
                //R 1 7 8 9
                if (i < 63 && c < 7) { set_bit(board, i + 1); }
                if (i < 57 && r < 7 && 0 < c) { set_bit(board, i + 7); }
                if (i < 56 && r < 7) { set_bit(board, i + 8); }
                if (i < 55 && r < 7 && c < 7) { set_bit(board, i + 9); }

                res[i] = board;
            }
        }
        return res;
    }

    PAWN_ATTACK = pawn_attack(); // [side][square]
    KNIGHT_ATTACK = knight_attack(); // [square]
    KING_ATTACK = king_attack(); // [square]
}

let BISHOP_RELEVANT_BITS = [
    6, 5, 5, 5, 5, 5, 5, 6, 
    5, 5, 5, 5, 5, 5, 5, 5, 
    5, 5, 7, 7, 7, 7, 5, 5, 
    5, 5, 7, 9, 9, 7, 5, 5, 
    5, 5, 7, 9, 9, 7, 5, 5, 
    5, 5, 7, 7, 7, 7, 5, 5, 
    5, 5, 5, 5, 5, 5, 5, 5, 
    6, 5, 5, 5, 5, 5, 5, 6
];
let ROOK_RELEVANT_BITS = [
    12, 11, 11, 11, 11, 11, 11, 12, 
    11, 10, 10, 10, 10, 10, 10, 11, 
    11, 10, 10, 10, 10, 10, 10, 11, 
    11, 10, 10, 10, 10, 10, 10, 11, 
    11, 10, 10, 10, 10, 10, 10, 11, 
    11, 10, 10, 10, 10, 10, 10, 11, 
    11, 10, 10, 10, 10, 10, 10, 11, 
    12, 11, 11, 11, 11, 11, 11, 12
];

function mask_bishop_attacks(square) {   
    let res = [0, 0];
    let r, f;
    let tr = square >>> 3;
    let tf = square & 7;
    for (r = tr + 1, f = tf + 1; r <= 6 && f <= 6; r++, f++) { set_bit(res, (r * 8) + f); }
    for (r = tr - 1, f = tf + 1; r >= 1 && f <= 6; r--, f++) { set_bit(res, (r * 8) + f); }
    for (r = tr + 1, f = tf - 1; r <= 6 && f >= 1; r++, f--) { set_bit(res, (r * 8) + f); }
    for (r = tr - 1, f = tf - 1; r >= 1 && f >= 1; r--, f--) { set_bit(res, (r * 8) + f); }
    return res;
}
function mask_rook_attacks(square) {
    let res = [0, 0];
    let r, f;
    let tr = square >>> 3;
    let tf = square & 7;
    for (r = tr + 1; r <= 6; r++) { set_bit(res, (r * 8) + tf); }
    for (r = tr - 1; r >= 1; r--) { set_bit(res, (r * 8) + tf); }
    for (f = tf + 1; f <= 6; f++) { set_bit(res, (tr * 8) + f); }
    for (f = tf - 1; f >= 1; f--) { set_bit(res, (tr * 8) + f); }
    return res;
}

function bishop_attack_fly(square, blocker) {
    let res = [0, 0];
    let r = square >>> 3; let c = square % 8;
    let o = 1;
    while (r + o < 8 && c + o < 8) { // + +
        let i = square + 9 * o;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (r + o < 8 && 0 <= c - o) { // + -
        let i = square + 7 * o;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= r - o && c + o < 8) { // - +
        let i = square - 7 * o;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= r - o && 0 <= c - o) { // - -
        let i = square - 9 * o;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    return res;
}
function rook_attack_fly(square, blocker) {
    let res = [0, 0];
    let r = square >>> 3; let c = square % 8;
    let o = 1;
    while (r + o < 8) { // + .
        let i = square + (o * 8);
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= r - o) { // - .
        let i = square - (o * 8);
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (c + o < 8) { // . +
        let i = square + o;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= c - o) { // . -
        let i = square - o;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    return res;
}
function queen_attack_fly(square, blocker) { return or(bishop_attack_fly(square, blocker), rook_attack_fly(square, blocker)); }


// Magic bitboard 32 bit test
function print_32(num) {
    let res = "";
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 8; j++) {
            res += num & (1 << ((i * 8) + j)) ? "1 " : "0 ";
        }
        res += "\n";
    }
    console.log(res);
}
let RANDOM_STATE = 1804289383;
function random_32() {
    RANDOM_STATE ^= RANDOM_STATE << 13;
    RANDOM_STATE ^= RANDOM_STATE >> 17;
    RANDOM_STATE ^= RANDOM_STATE << 5;
    // return Math.floor(Math.random() * 4294967295);
    return RANDOM_STATE;
}
function random_64() { 
    let x1 = random_32() & 0xffff;
    let x2 = random_32() & 0xffff;
    let x3 = random_32() & 0xffff;
    let x4 = random_32() & 0xffff;
    return [x1 | (x2 << 16), x3 | (x4 << 16)];
}
function random_magic() { return and(random_64(), and(random_64(), random_64())); }
function get_occupancy(index, free_bits_in_mask, attack_mask) {
    let res = [0, 0];
    let mask = copy_bitboard(attack_mask);
    for (let i = 0; i < free_bits_in_mask; i++) {
        let square = pop_lsb_index(mask);
        if (index & (1 << i)) { // ith bit must be in index binary
            set_bit(res, square);
        }
    }
    return res;
}

// (xL * yL) + (xH * yL + xL * yH) * 2^32
function transform(mask, magic, bits) {
    // return ((mask[0] * magic[0]) ^ (mask[1] * magic[0])) >>> (32 - bits); 

    let r = bin_mult(bin_bitboard(mask), bin_bitboard(magic));
    let s = r.length - 64;
    return parseInt(r.slice(s, s + bits), 2);

    // let res = ((mask[0] * magic[1]) + (mask[1] * magic[0])) >>> 0;
    // if (count_bits_number(mask[0]) + count_bits_number(magic[0]) >= 52) {
    //     res += (mask[0] * magic[0]) >>> 16;
    // }
    // return res >>> (32 - bits); 
} 

function my_generate_magic(square, is_bishop) {
    let relevant_bits = is_bishop ? BISHOP_RELEVANT_BITS[square] : ROOK_RELEVANT_BITS[square];
    let occupancy_indicies = 1 << relevant_bits;
    let attack_mask = is_bishop ? mask_bishop_attacks(square) : mask_rook_attacks(square)

    let occupancies = new Array(4096);
    let attacks = new Array(4096);
    for (let i = 0; i < occupancy_indicies; i++) {
        occupancies[i] = get_occupancy(i, relevant_bits, attack_mask); 
        attacks[i] = is_bishop ? bishop_attack_fly(square, occupancies[i]) : rook_attack_fly(square, occupancies[i]);
    }

    console.log("GOAL =", occupancy_indicies);
    let used_attacks = new Array(4096);
    for (let i = 0; i < used_attacks.length; i++) { used_attacks[i] = [0, 0]; }
    let max = 0;
    for (let r = 0; r < 10000; r++) {
        let magic = random_magic();
        // if (count_bits_number(transform(attack_mask, magic, 8)) < 6) { continue; }

        let fail = 0;
        for (let i = 0; !fail && i < occupancy_indicies; i++) {
            let magic_index = transform(occupancies[i], magic, relevant_bits);
            if (!bool_bitboard(used_attacks[magic_index])) {
                used_attacks[magic_index] = attacks[i];
            } else if (!equal(used_attacks[magic_index], attacks[i])) {
                if (i > max) { max = i; console.log("M =", i); }
                fail = 1;
            }
        }
        if (!fail) { console.log("R =", r); return magic; }
    }
    console.log("*************** FAIL ***************");
    return 0;
}

function test_magic(square, magic, occupancy, is_bishop) {
    let relevant_bits = is_bishop ? BISHOP_RELEVANT_BITS[square] : ROOK_RELEVANT_BITS[square];
    let res = transform(occupancy, magic, relevant_bits[square]);
    console.log(res);
    print_32(res);
    return res;

}

let ROOK_MAGICS = new Array(64);
let BISHOP_MAGICS = new Array(64);
function initialise_magics() {
    for (let i = 0; i < 64; i++) {
        ROOK_MAGICS[i] = my_generate_magic(i, 0);
        BISHOP_MAGICS[i] = my_generate_magic(i, 1);
    }
}
let BISHOP_ATTACKS = new Array(64);
let ROOK_ATTACKS = new Array(64);
for (let i = 0; i < 64; i++) {
    BISHOP_ATTACKS[i] = new Array(512);
    ROOK_ATTACKS[i] = new Array(4096);
}

function initialise_slide_attacks(is_bishop) {
    for (let square = 0; square < 64; square++) {
        BISHOP_ATTACKS[square] = mask_bishop_attacks(square);
        ROOK_ATTACKS[square] = mask_rook_attacks(square);
        
        let attack_mask = is_bishop ? BISHOP_ATTACKS[square] : ROOK_ATTACKS[square];
        let relevant_bits_count = is_bishop ? BISHOP_RELEVANT_BITS[square] : ROOK_RELEVANT_BITS[square];
        let occupancy_indicies = 1 << relevant_bits_count;

        for (let index = 0; index < occupancy_indicies; index++) {
            let occupancy = get_occupancy(index, relevant_bits_count, attack_mask);
            let magic_index = is_bishop ? 
                transform(occupancy, BISHOP_MAGICS[square], BISHOP_RELEVANT_BITS[square]) :
                transform(occupancy, ROOK_MAGICS[square], ROOK_RELEVANT_BITS[square]);
            if (is_bishop) {
                BISHOP_ATTACKS[square][magic_index] = bishop_attack_fly(square, occupancy);
            } else {
                ROOK_ATTACKS[square][magic_index] = rook_attack_fly(square, occupancy);
            }
        }
    }
}

function test_magic_final(square, occupancy_index, is_bishop) {
    let relevant_bits = is_bishop ? BISHOP_RELEVANT_BITS[square] : ROOK_RELEVANT_BITS[square];
    let attack_mask = is_bishop ? mask_bishop_attacks(square) : mask_rook_attacks(square);
    let magic = is_bishop ? BISHOP_MAGICS[square] : ROOK_MAGICS[square];
    let occ = get_occupancy(occupancy_index, relevant_bits, attack_mask); 

    let magic_index = transform(occ, magic, relevant_bits);
    console.log(magic_index);
    let res = is_bishop ? BISHOP_ATTACKS[square][magic_index] : ROOK_ATTACKS[square][magic_index];
    print_bitboard(occ);
    print_bitboard(res);
}

// initialise_magics();
// initialise_slide_attacks();

let START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";