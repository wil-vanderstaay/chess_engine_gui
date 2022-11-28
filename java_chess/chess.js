function square_index(name) { return name[0].charCodeAt() - (parseInt(name[1]) << 3) - 33; }
function square_name(index) { return String.fromCharCode(index % 8 + 97) + (8 - (index >> 3)) }

// MOVE ----------------------------------------------------------------------------------------------------------------------
/* 
    A single number to represent a move 
    Bitwise encoding
    0000 0000 0000 0000 0011 1111   source square
    0000 0000 0000 1111 1100 0000   target square
    0000 0000 1111 0000 0000 0000   piece 
    0000 1111 0000 0000 0000 0000   promoted piece 
    0001 0000 0000 0000 0000 0000   capture flag
    0010 0000 0000 0000 0000 0000   double push flag
    0100 0000 0000 0000 0000 0000   enpassant flag
    1000 0000 0000 0000 0000 0000   castling flag
*/
function create_move(source, target, piece, promote=0, capture=0, double=0, enpassant=0, castle=0) {
    return (source) | (target << 6) | (piece << 12) | (promote << 16) | (capture << 20) | (double << 21) | (enpassant << 22) | (castle << 23);
}
function create_move_uci(uci) {
    let source = square_index(uci[0] + uci[1]);
    let target = square_index(uci[2] + uci[3]);
    let piece = 0;
    for (let i = 0; i < 12; i++) {
        if (get_bit(BOARD[i], source)) {
            piece = i;
            break;
        }
    }
    let letters = " nbrq";
    let promote = 0;
    if (uci.length == 5) { promote = letters.indexOf(uci[4]) + 6 * TURN; }
    let double = !(piece % 6) && Math.abs((source >> 3) - (target >> 3)) == 2;
    let enpassant = !(piece % 6) && Math.abs((source % 8) - (target % 8)) == 1 && !get_bit(BOARD[14], target);
    let capture = (enpassant || get_bit(BOARD[14], target)) ? 1 : 0;
    let castle = piece % 6 == 5 && Math.abs((source % 8) - (target % 8)) == 2;
    return create_move(source, target, piece, promote, capture, double, enpassant, castle);
}
function create_move_san(san) {
    san = san.replace("+", "");
    let is_promote = san.includes("=");
    let is_pawn = san[0] != san[0].toUpperCase();
    let letters = " NBRQK"; // TODO: check if can be lowercase??

    let number_index = is_promote ? san.length - 3 : san.length - 1;
    let target = square_index(san[number_index - 1] + san[number_index]);
    let piece = is_pawn ? 0 : letters.indexOf(san[0]);
    let promote = san.includes("=") ? letters.indexOf(san[san.length - 1]) : 0;
    if (TURN) {
        piece += 6;
        if (promote) {
            promote += 6;
        }
    }
    let capture = san.includes("x") ? 1 : 0;
    let enpassant = (capture && !get_bit(BOARD[14], target)) ? 1 : 0;
    let castle = san.includes("-") ? 1 : 0;

    let source;
    let bitboard;
    switch (piece % 6) {
        case 0: { 
            if (capture) {
                bitboard = and_bitboards(PAWN_ATTACK[TURN ^ 1][target], BOARD[piece]);
            } else {
                bitboard = and_bitboards(COL_MASKS[target], BOARD[piece]);
            }
            break;
        } 
        case 1: { 
            bitboard = and_bitboards(KNIGHT_ATTACK[target], BOARD[piece]); break;
        } 
        case 2: { 
            bitboard = and_bitboards(bishop_attack_fly(target, BOARD[14]), BOARD[piece]); break;
        } 
        case 3: { 
            bitboard = and_bitboards(rook_attack_fly(target, BOARD[14]), BOARD[piece]); break;
        } 
        case 4: { 
            bitboard = and_bitboards(queen_attack_fly(target, BOARD[14]), BOARD[piece]); break;
        } 
        case 5: { 
            bitboard = and_bitboards(KING_ATTACK[target], BOARD[piece]); break;
        }
    }
    if (count_bits(bitboard) == 1) {
        source = lsb_index(bitboard);
    } else {
        let mask = isNaN(san[1]) ? COL_MASKS[san[1].charCodeAt() - 97] : ROW_MASKS[parseInt(san[1]) << 3]
        source = lsb_index(and_bitboards(bitboard, mask));
    }
    let double = (is_pawn && Math.abs((source >> 3) - (target >> 3)) == 2) ? 1 : 0;
    return create_move(source, target, piece, promote, capture, double, enpassant, castle);
}
function get_move_source(move) { return move & 63; }
function get_move_target(move) { return (move & 4032) >> 6; }
function get_move_piece(move) { return (move & 61440) >> 12; }
function get_move_promote(move) { return (move & 983040) >> 16; }
function get_move_capture(move) { return (move & 1048576) >> 20; }
function get_move_double(move) { return (move & 2097152) >> 21; }
function get_move_enpassant(move) { return (move & 4194304) >> 22; }
function get_move_castle(move) { return (move & 8388608) >> 23; }
function get_move_uci(move) { 
    let letters = " nbrq";
    let promote = get_move_promote(move) % 6;
    return square_name(get_move_source(move)) + square_name(get_move_target(move)) + (promote ? letters[promote] : ""); 
}
function get_move_san(move, moves=[]) { 
    let uci = get_move_uci(move);

    let res = "";
    let letters = ["", "N", "B", "R", "Q", "K"];
    let source = get_move_source(move);
    let target = get_move_target(move);
    let piece = get_move_piece(move);
    let promote = get_move_promote(move);
    let capture = get_move_capture(move);

    if (get_move_castle(move)) { return (source < target) ? "O-O" : "O-O-O"; }
    
    res += letters[piece % 6];
    if (!res && capture) { res += uci[0]; }
    // Disambiguate moves Nge2
    if (moves.length) {
        for (let i = 0; i < moves.length; i++) {
            let m = moves[i];
            if (m != move && piece % 6 && get_move_piece(m) == piece && get_move_target(m) == target) {
                let ms = get_move_source(m);
                if ((ms % 8) == (source % 8)) { res += uci[1]; }
                else { res += uci[0]; }
                break;
            }
        }
    }
    if (capture) { res += "x"; }
    res += square_name(target);
    if (promote) { 
        res += "=";
        if (promote == 15) {
            for (let i = 0; i < 12; i++) {
                if (get_bit(BOARD[i], target)) {
                    res += letters[i % 6];
                    break;
                }
            }
        } else {
            res += letters[promote % 6]; 
        }
    }    
    return res;
}
function print_move(move) {
    let res = "";
    res += (square_name(get_move_source(move))) + " " + (square_name(get_move_target(move))) + " " + (get_move_piece(move)) + ".";
    if (get_move_promote(move)) { res += " P " + get_move_promote(move) + "."; }
    if (get_move_capture(move)) { res += " X."; }
    if (get_move_double(move)) { res += " D."; }
    if (get_move_enpassant(move)) { res += " E."; }
    if (get_move_castle(move)) { res += " O-O."; }
    console.log(res);
}

// CASTLE ----------------------------------------------------------------------------------------------------------------------
/*
    A single number to represent castling rights

    Bitwise encoding
    0001    player king
    0010    player queen
    0100    ai king
    1000    ai queen
*/
function create_castle(castle_str) {
    let res = 0;
    let lookup = "KQkq";
    for (let i = 0; i < castle_str.length; i++) {
        res |= 1 << lookup.indexOf(castle_str[i]);
    }
    return res;
}
let CASTLING_RIGHTS = [
    7, 15, 15, 15,  3, 15, 15, 11,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15, 
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    13, 15, 15, 15, 12, 15, 15, 14
];
function update_castle(castle, source, target) {
    hash_key = xor_bitboards(hash_key, ZOB_TABLE[65][castle]);
    castle &= CASTLING_RIGHTS[source];
    castle &= CASTLING_RIGHTS[target];
    hash_key = xor_bitboards(hash_key, ZOB_TABLE[65][castle]);
    return castle;
}

function print_castle(castle) {
    console.log(get_castle_wk(castle) + " " + get_castle_wq(castle) + ", " + get_castle_bk(castle) + " " + get_castle_bq(castle));
}
function get_castle_wk(castle) { return castle & 1; }
function get_castle_wq(castle) { return (castle & 2) >> 1; }
function get_castle_bk(castle) { return (castle & 4) >> 2; }
function get_castle_bq(castle) { return (castle & 8) >> 3; }
    
// BITBOARD ----------------------------------------------------------------------------------------------------------------------
/*
    A list of 2 32-bit numbers to represent the board (due to javascript number limitations)
    First number for top 32 squares, second number for bottom 32 squares
*/
function and_bitboards(bitboard1, bitboard2) {
    return [bitboard1[0] & bitboard2[0], bitboard1[1] & bitboard2[1]];
}
function or_bitboards(bitboard1, bitboard2) {
    return [bitboard1[0] | bitboard2[0], bitboard1[1] | bitboard2[1]];
}
function xor_bitboards(bitboard1, bitboard2) {
    return [bitboard1[0] ^ bitboard2[0], bitboard1[1] ^ bitboard2[1]];
}
function nand_bitboards(bitboard1, bitboard2) {
    return [bitboard1[0] & ~bitboard2[0], bitboard1[1] & ~bitboard2[1]]
}

function get_bit(bitboard, i) {
    if (i < 32) { 
        return bitboard[0] & (1 << i); 
    }
    return bitboard[1] & (1 << i);
}
function set_bit(bitboard, i) {
    if (i < 32) {
        bitboard[0] |= (1 << i);
    } else {
        bitboard[1] |= (1 << i);
    }
}
function pop_bit(bitboard, i) {
    let bit = get_bit(bitboard, i);
    if (bit) {
        if (i < 32) {
            bitboard[0] ^= (1 << i); 
        } else {
            bitboard[1] ^= (1 << i); 
        }
    }
    return bit;
}

function count_number_bits(number) {
	number -= (number >>> 1) & 0x55555555;
	number = (number & 0x33333333) + ((number >>> 2) & 0x33333333);
	return ((number + (number >>> 4) & 0xF0F0F0F) * 0x1010101) >>> 24;
}
function count_bits(bitboard) {
    return count_number_bits(bitboard[0]) + count_number_bits(bitboard[1]);
}

function lsb_number_index(number) {
    return count_number_bits((number & -number) - 1);
}
function lsb_index(bitboard) {
    if (bitboard[0]) {
        return lsb_number_index(bitboard[0]);
    }
    return 32 + lsb_number_index(bitboard[1]);
}
function pop_lsb_index(bitboard) {
    let index;
    if (bitboard[0]) {
        index = lsb_number_index(bitboard[0]);
        bitboard[0] &= bitboard[0] - 1;
    } else {
        index = 32 + lsb_number_index(bitboard[1]);
        bitboard[1] &= bitboard[1] - 1;
    }
    return index;
}

function bool_bitboard(bitboard) {
    return bitboard[0] || bitboard[1];
}
function copy_bitboard(bitboard) {
    return [bitboard[0], bitboard[1]];
}
function print_bitboard(bitboard) {
    let res = "";
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            res += get_bit(bitboard, (i << 3) + j) ? "1 " : "0 ";
        }
        res += "\n";
    }
    console.log(res);
}

// BOARD ----------------------------------------------------------------------------------------------------------------------
/*
    An array of 15 bitboards to represent the pieces of any board states
    12 piece bitboards starting with the player pieces then ai pieces, pawn knight bishop rook queen king
    3 occupancy bitboards to represent all the player pieces, ai pieces and pieces on the entire board
*/
function create_board(board) { // board is a 64-length list containing piece values or 0 for empty
    let res = new Array(15);
    for (let i = 0; i < res.length; i++) {
        res[i] = [0, 0];
    }
    for (let i = 0; i < 64; i++) { // pieces
        let piece = board[i];
        if (piece) {
            set_bit(res[piece - 1], i);
        }
    }
    for (let i = 0; i < 6; i++) { // white
        res[12] = or_bitboards(res[12], res[i]);
    }
    for (let i = 6; i < 12; i++) { // black
        res[13] = or_bitboards(res[13], res[i]);
    }
    res[14] = or_bitboards(res[12], res[13]); // board
    return res;
}

function copy_board(board) {
    let res = [];
    for (let i = 0; i < board.length; i++) {
        res.push(copy_bitboard(board[i]));
    }
    return res;
}

function legal_move(pos, new_pos) { // determine if moving from pos to new_pos is a possible move
    let moves = generate_pseudo_moves();
    for (let i = 0; i < moves.length; i++) {
        let move = moves[i];
        if (get_move_source(move) == pos && get_move_target(move) == new_pos) {
            return [move, moves];
        }
    }
    return [0, moves];
}

function print_board(board) {
    let letters = "PNBRQKpnbrqk";
    let res = "";
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            let k = (i << 3) + j;
            if (get_bit(board[14], k)) {
                for (let p = 0; p < 12; p++) {
                    if (get_bit(board[p], k)) {
                        res += letters[p] + " ";
                        break;
                    }
                }
            } else {
                res += "- ";
            }
        }
        res += "\n";
    }
    console.log(res);
}

function do_move(move, ignore_check=false) {
    if (!move) { return false; }

    let cb = copy_board(BOARD);
    let cc = CASTLE;
    let ce = EN_PASSANT_SQUARE;
    let ch = copy_bitboard(hash_key);

    let source = get_move_source(move);
    let target = get_move_target(move);
    let piece = get_move_piece(move);

    // Remove captured piece
    if (get_move_capture(move)) {
        for (let i = 0; i < 12; i++) {     
            if (get_bit(BOARD[i], target)) {
                pop_bit(BOARD[i], target);
                hash_key = xor_bitboards(hash_key, ZOB_TABLE[target][i]);
                break;
            }
        }
    }

    // Move piece
    pop_bit(BOARD[piece], source);
    set_bit(BOARD[piece], target);
    hash_key = xor_bitboards(hash_key, ZOB_TABLE[source][piece]);
    hash_key = xor_bitboards(hash_key, ZOB_TABLE[target][piece]);

    // Set promote piece
    if (get_move_promote(move)) {
        let promote_piece = get_move_promote(move);
        if (promote_piece == 15) { // reserved for player promote piece
            let input = window.prompt("N B R Q: ").toUpperCase() + " ";
            let value = "NBRQ".indexOf(input[0]) + 1;
            if (!value) { value = 4; }
            promote_piece = piece + value;
            move = (move & 15794175) | (promote_piece << 16);
        }
        pop_bit(BOARD[piece], target);
        set_bit(BOARD[promote_piece], target);
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[target][piece]);
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[target][promote_piece]);

    // Perform enpassant
    } else if (get_move_enpassant(move)) {
        if (TURN) { // black turn
            pop_bit(BOARD[0], target - 8);
            hash_key = xor_bitboards(hash_key, ZOB_TABLE[target - 8][0]);
        } else { // white turn
            pop_bit(BOARD[6], target + 8);
            hash_key = xor_bitboards(hash_key, ZOB_TABLE[target + 8][6]);
        }

    // Perform castle 
    } else if (get_move_castle(move)) {
        let kingside = (target == 62) || (target == 6); 
        let rook_source = (kingside) ? target + 1 : target - 2;
        let rook_target = (kingside) ? target - 1 : target + 1;

        pop_bit(BOARD[piece - 2], rook_source);
        set_bit(BOARD[piece - 2], rook_target);
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[rook_source][piece - 2]);
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[rook_target][piece - 2]);
    } 
    
    // Re-validate hash key
    if (EN_PASSANT_SQUARE) {
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[66][EN_PASSANT_SQUARE]);
    }
    EN_PASSANT_SQUARE = null;
    if (get_move_double(move)) {
        if (TURN) { // black turn
            EN_PASSANT_SQUARE = target - 8;
        } else { // white turn
            EN_PASSANT_SQUARE = target + 8;
        }
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[66][EN_PASSANT_SQUARE]);   
    }

    CASTLE = update_castle(CASTLE, source, target);

    // Update occupancies
    BOARD[12] = [0, 0];
    BOARD[13] = [0, 0];
    for (let i = 0; i < 6; i++) { // white
        BOARD[12] = or_bitboards(BOARD[12], BOARD[i]);
    }
    for (let i = 6; i < 12; i++) { // black
        BOARD[13] = or_bitboards(BOARD[13], BOARD[i]);
    }
    BOARD[14] = or_bitboards(BOARD[12], BOARD[13]); // board

    // Moving into check, reset state
    if (!ignore_check && is_square_attacked(lsb_index(BOARD[6 * TURN + 5]), TURN ^ 1)) {
        BOARD = cb;
        CASTLE = cc;
        EN_PASSANT_SQUARE = ce;
        hash_key = ch;
        return false;
    }
    TURN ^= 1;
    hash_key = xor_bitboards(hash_key, ZOB_TABLE[64]);
    return true;
}

// HASHING -----------------------------------------------------------------------------------------------------------------------------------------------

class HashEntry {
    constructor() {
        this.first = 0;
        this.last = 0;
        this.depth = 0;

        this.flag = 0;
        this.score = 0;
        this.move = 0;
    }
}
class HashTable { // store score of positions previously explored at certain depth and its type 
    constructor() {
        this.hashes = {};
    }   

    get(depth, alpha, beta) {
        let key = ((hash_key[0] % HASH_SIZE) + (hash_key[1] % HASH_SIZE)) % HASH_SIZE;
        let entry = this.hashes[key];
        if (entry != null && entry.first == hash_key[0] && entry.last == hash_key[1]) {
            if (entry.depth >= depth) {
                if (entry.flag == 1) { return [0, entry.score]; } // exact
                else if (entry.flag == 2 && entry.score <= alpha) { return [0, alpha]; } // alpha
                else if (entry.flag == 3 && entry.score >= beta) { return [0, beta]; } // beta
            }
            return [1, entry.move];
        }
        return [0, null];
    }

    set(depth, flag, score, move) {
        let entry = new HashEntry();
        entry.first = hash_key[0];
        entry.last = hash_key[1];
        entry.depth = depth;
        entry.flag = flag;
        entry.score = score;
        entry.move = move;

        let key = ((hash_key[0] % HASH_SIZE) + (hash_key[1] % HASH_SIZE)) % HASH_SIZE;
        this.hashes[key] = entry;
    }
}

function init_zobrist() { // random number lists to xor with hash key for nearly-unique board identifiers
    let number = Math.pow(2, 32);
    ZOB_TABLE = [];
    for (let i = 0; i < 64; i++) {
        let square = [];
        for (let j = 0; j < 12; j++) {
            square.push([Math.floor(Math.random() * number), Math.floor(Math.random() * number)]);
        }
        ZOB_TABLE.push(square);
    }
    ZOB_TABLE.push([Math.floor(Math.random() * number), Math.floor(Math.random() * number)]); // ZOB_TABLE[64] = turn
    
    let castles = [];
    for (let k = 0; k < 16; k++) {
        castles.push([Math.floor(Math.random() * number), Math.floor(Math.random() * number)]); // ZOB_TABLE[65][c] = castle
    }
    ZOB_TABLE.push(castles);

    let enpass = [];
    for (let l = 0; l < 64; l++) {
        enpass.push([Math.floor(Math.random() * number), Math.floor(Math.random() * number)]); // ZOB_TABLE[66][e] = en passant
    }
    ZOB_TABLE.push(enpass);
}

function init_hash() {
    let res = [0, 0];
    for (let i = 0; i < 12; i++) {
        let b = copy_bitboard(BOARD[i]);
        while (bool_bitboard(b)) {
            let square = pop_lsb_index(b);
            res = xor_bitboards(res, ZOB_TABLE[square][i]);
        }
    }
    if (TURN) { res = xor_bitboards(res, ZOB_TABLE[64]); }
    res = xor_bitboards(res, ZOB_TABLE[65][CASTLE]) // castle
    if (EN_PASSANT_SQUARE) { res = xor_bitboards(res, ZOB_TABLE[66][EN_PASSANT_SQUARE]); }
    return res;
}

function is_repetition() {
    return GAME_HASH.filter(x => x[0] == hash_key[0] && x[1] == hash_key[1]).length >= 3;
}

// DEFINE MOVES ----------------------------------------------------------------------------------------------------------------------

function initialise_constants() { // attack masks for pawns knights kings from any square 
    PAWN_ATTACK = pawn_attack(); // [side][square]
    KNIGHT_ATTACK = knight_attack(); // [square]
    KING_ATTACK = king_attack(); // [square]

    init_zobrist();
    reset_search_tables();

    ROW_MASKS = new Array(64); 
    COL_MASKS = new Array(64);
    for (let i = 0; i < 8; i++) {
        let row = set_row_col_mask(i, -1);
        let col = set_row_col_mask(-1, i);
        for (let j = 0; j < 8; j++) {
            ROW_MASKS[(i << 3) + j] = row;
            COL_MASKS[(j << 3) + i] = col;
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

    function set_row_col_mask(row, col) {
        let res = [0, 0];
        if (row >= 0) {
            for (let i = 0; i < 8; i++) {
                set_bit(res, (row << 3) + i);
            }
        } 
        if (col >= 0) {
            for (let i = 0; i < 8; i++) {
                set_bit(res, (i << 3) + col);
            }
        } 
        return res;
    }
}

function bishop_attack_fly(square, blocker) {
    let res = [0, 0];
    let r = square >> 3; let c = square % 8;
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
    let r = square >> 3; let c = square % 8;
    let o = 1;
    while (r + o < 8) { // + .
        let i = square + (o << 3);
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= r - o) { // - .
        let i = square - (o << 3);
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
function queen_attack_fly(square, blocker) {
    return or_bitboards(bishop_attack_fly(square, blocker), rook_attack_fly(square, blocker));
}

// GENERATE MOVES ----------------------------------------------------------------------------------------------------------------------

function is_square_attacked(square, side) {
    let att_piece = side * 6;
    // Attacked by white pawns
    if (!side && bool_bitboard(and_bitboards(PAWN_ATTACK[1][square], BOARD[0]))) { return 1; }
    // Attacked by black pawns
    if (side && bool_bitboard(and_bitboards(PAWN_ATTACK[0][square], BOARD[6]))) { return 1; }
    // Attacked by knights
    if (bool_bitboard(and_bitboards(KNIGHT_ATTACK[square], BOARD[att_piece + 1]))) { return 2; }
    // Attacked by bishops
    if (bool_bitboard(and_bitboards(bishop_attack_fly(square, BOARD[14]), BOARD[att_piece + 2]))) { return 3; }
    // Attacked by rooks
    if (bool_bitboard(and_bitboards(rook_attack_fly(square, BOARD[14]), BOARD[att_piece + 3]))) { return 4; }
    // Attacked by queens
    if (bool_bitboard(and_bitboards(queen_attack_fly(square, BOARD[14]), BOARD[att_piece + 4]))) { return 5; }
    // Attacked by kings
    if (bool_bitboard(and_bitboards(KING_ATTACK[square], BOARD[att_piece + 5]))) { return 6; }
    
    return 0;
}

function generate_pseudo_moves() {
    let moves = [];
    // Pawn moves
    let piece = 6 * TURN;
    let piece_board = copy_bitboard(BOARD[piece]);
    let pawn_direction = TURN ? 8 : -8;
    while (bool_bitboard(piece_board)) {
        let source = pop_lsb_index(piece_board);
        let target = source + pawn_direction;

        // Push
        if (!get_bit(BOARD[14], target)) {
            if (target < 8 || 56 <= target) { // promotion
                moves.push(create_move(source, target, piece, piece + 1)); // knight
                moves.push(create_move(source, target, piece, piece + 2)); // bishop
                moves.push(create_move(source, target, piece, piece + 3)); // rook
                moves.push(create_move(source, target, piece, piece + 4)); // queen
            } else {
                // One square push
                moves.push(create_move(source, target, piece));
                // Two square push
                let srow = source >> 3;
                if (srow == (TURN ? 1 : 6) && !get_bit(BOARD[14], target + pawn_direction)) {
                    moves.push(create_move(source, target + pawn_direction, piece, 0, 0, 1));
                }
            }
        }

        // Capture
        let attacks = and_bitboards(PAWN_ATTACK[TURN][source], BOARD[12 + TURN ^ 1]);
        while (bool_bitboard(attacks)) {
            let att = pop_lsb_index(attacks);
            let arow = att >> 3;
            if (arow == 0 || arow == 7) { // Promote
                moves.push(create_move(source, att, piece, piece + 1, 1));
                moves.push(create_move(source, att, piece, piece + 2, 1));
                moves.push(create_move(source, att, piece, piece + 3, 1));
                moves.push(create_move(source, att, piece, piece + 4, 1));
            } else {
                moves.push(create_move(source, att, piece, 0, 1));
            }

        }
        // En passant
        if (EN_PASSANT_SQUARE && get_bit(PAWN_ATTACK[TURN][source], EN_PASSANT_SQUARE)) {
                moves.push(create_move(source, EN_PASSANT_SQUARE, piece, 0, 1, 0, 1));
        }
    }
    // Knight moves
    piece++;
    piece_board = copy_bitboard(BOARD[piece]);
    while(bool_bitboard(piece_board)) {
        let source = pop_lsb_index(piece_board);
        let attacks = nand_bitboards(KNIGHT_ATTACK[source], BOARD[12 + TURN]);
        while (bool_bitboard(attacks)) {
            let att = pop_lsb_index(attacks);
            if (get_bit(BOARD[12 + TURN ^ 1], att)) {
                moves.push(create_move(source, att, piece, 0, 1));
            } else {
                moves.push(create_move(source, att, piece));
            }
        }
    }
    // Bishop moves
    piece++;
    piece_board = copy_bitboard(BOARD[piece]);
    while(bool_bitboard(piece_board)) {
        let source = pop_lsb_index(piece_board);
        let attacks = nand_bitboards(bishop_attack_fly(source, BOARD[14]), BOARD[12 + TURN]);
        while (bool_bitboard(attacks)) {
            let att = pop_lsb_index(attacks);
            if (get_bit(BOARD[12 + TURN ^ 1], att)) {
                moves.push(create_move(source, att, piece, 0, 1));
            } else {
                moves.push(create_move(source, att, piece));
            }
        }
    }
    // Rook moves
    piece++;
    piece_board = copy_bitboard(BOARD[piece]);
    while(bool_bitboard(piece_board)) {
        let source = pop_lsb_index(piece_board);
        let attacks = nand_bitboards(rook_attack_fly(source, BOARD[14]), BOARD[12 + TURN]);
        while (bool_bitboard(attacks)) {
            let att = pop_lsb_index(attacks);
            if (get_bit(BOARD[12 + TURN ^ 1], att)) {
                moves.push(create_move(source, att, piece, 0, 1));
            } else {
                moves.push(create_move(source, att, piece));
            }
        }
    }
    // Queen moves
    piece++;
    piece_board = copy_bitboard(BOARD[piece]);
    while(bool_bitboard(piece_board)) {
        let source = pop_lsb_index(piece_board);
        let attacks = nand_bitboards(queen_attack_fly(source, BOARD[14]), BOARD[12 + TURN]);
        while (bool_bitboard(attacks)) {
            let att = pop_lsb_index(attacks);
            if (get_bit(BOARD[12 + TURN ^ 1], att)) {
                moves.push(create_move(source, att, piece, 0, 1));
            } else {
                moves.push(create_move(source, att, piece));
            }
        }
    }
    // King moves
    piece++;
    piece_board = copy_bitboard(BOARD[piece]);
    // Normal moves
    let source = lsb_index(piece_board);
    let attacks = nand_bitboards(KING_ATTACK[source], BOARD[12 + TURN]);
    while (bool_bitboard(attacks)) {
        let att = pop_lsb_index(attacks);
        if (get_bit(BOARD[12 + TURN ^ 1], att)) {
            moves.push(create_move(source, att, piece, 0, 1));
        } else {
            moves.push(create_move(source, att, piece));
        }
    }

    // Castling
    if (CASTLE) {
        let king_pos = TURN ? 4 : 60;
        if (TURN ? get_castle_bk(CASTLE) : get_castle_wk(CASTLE)) {
            if (!get_bit(BOARD[14], king_pos + 1) && !get_bit(BOARD[14], king_pos + 2)) {
                if (!is_square_attacked(king_pos, TURN ^ 1) && !is_square_attacked(king_pos + 1, TURN ^ 1)) {
                    moves.push(create_move(king_pos, king_pos + 2, piece, 0, 0, 0, 0, 1));
                }
            }
        }
        if (TURN ? get_castle_bq(CASTLE) : get_castle_wq(CASTLE)) {
            if (!get_bit(BOARD[14], king_pos - 1) && !get_bit(BOARD[14], king_pos - 2) && !get_bit(BOARD[14], king_pos - 3)) {
                if (!is_square_attacked(king_pos, TURN ^ 1) && !is_square_attacked(king_pos - 1, TURN ^ 1)) {
                    moves.push(create_move(king_pos, king_pos - 2, piece, 0, 0, 0, 0, 1));
                }
            }
        }
    }
    return moves;
}

function generate_capture_moves() {
    let moves = generate_pseudo_moves();
    let res = [];
    for (let i = 0; i < moves.length; i++) {
        if (get_move_capture(moves[i])) {
            res.push(moves[i]);
        } 
    }
    return res;
}

function finish() {
    let message = "Stalemate";
    if (is_square_attacked(lsb_index(BOARD[6 * TURN + 5]), TURN ^ 1)) {
        message = "Checkmate. " + (TURN ? "White" : "Black") + " wins";
    } else {
        let moves = generate_pseudo_moves();
        for (let i = 0; i < moves.length; i++) {
            if (do_move(moves[i])) {
                message = "Threefold repetition";
                break;
            }
        }
    }
    setTimeout(() => { alert(message); }, 250);
}

function opponent_att_mask() {
    let res = [0, 0];
    // Pawn moves
    let piece = PLAYER_WHITE ? 6 : 0;
    let piece_board = copy_bitboard(BOARD[piece]);
    while (bool_bitboard(piece_board)) {
        res = or_bitboards(res, PAWN_ATTACK[PLAYER_WHITE ? 1 : 0][pop_lsb_index(piece_board)]);
    }
    // Knight moves
    piece++;
    piece_board = copy_bitboard(BOARD[piece]);
    while(bool_bitboard(piece_board)) {
        res = or_bitboards(res, KNIGHT_ATTACK[pop_lsb_index(piece_board)]);
    }
    // Bishop moves
    piece++;
    piece_board = copy_bitboard(BOARD[piece]);
    while(bool_bitboard(piece_board)) {
        res = or_bitboards(res, bishop_attack_fly(pop_lsb_index(piece_board), BOARD[14]));
    }
    // Rook moves
    piece++;
    piece_board = copy_bitboard(BOARD[piece]);
    while(bool_bitboard(piece_board)) {
        res = or_bitboards(res, rook_attack_fly(pop_lsb_index(piece_board), BOARD[14]));
    }
    // Queen moves
    piece++;
    piece_board = copy_bitboard(BOARD[piece]);
    while(bool_bitboard(piece_board)) {
        res = or_bitboards(res, queen_attack_fly(pop_lsb_index(piece_board), BOARD[14]));
    }
    // King moves
    piece++;
    piece_board = copy_bitboard(BOARD[piece]);
    return or_bitboards(res, KING_ATTACK[pop_lsb_index(piece_board)]);
}

function is_repetition() {
    return GAME_HASH.filter(x => x[0] == hash_key[0] && x[1] == hash_key[1]).length >= 3;
}

// HTML ----------------------------------------------------------------------------------------------------------------------

function run_setup_board() {
    let button = document.getElementById("setup");
    if (button.style.backgroundColor == "rgb(187, 224, 174)") {
        console.log("HERE");
        if (count_bits(BOARD[5]) != 1 || count_bits(BOARD[11]) != 1) {
            alert("Invalid position");
            setup_board();
            return;
        }
        button.style.backgroundColor = "";
        TURN = 0;
        display_board();
        start_game(PLAYER_WHITE, get_fen());
    } else {
        button.style.backgroundColor = "#bbe0ae";
        setup_board();
    }
}

function setup_board() {
    for (let i = 0; i < 64; i++) {
        if (get_bit(BOARD[14], i)) {
            pieceDrag(document.getElementById((i)), i, true, true);
        }
    }
}

function add_piece() {
    let input = window.prompt("Add a piece to the board\nW/B then P N B R Q K: ");
    if (!input) { return; }
    input = input.toUpperCase();
    let letters = "PNBRQK";
    if (input.length != 2 || !letters.includes(input[1]) || !"WB".includes(input[0])) { return; }

    let promote_piece = (input[0] == "W" ? 0 : 6) + letters.indexOf(input[1]);
    for (let i = 0; i < 64; i++) {
        if (!get_bit(BOARD[14], i)) {
            set_bit(BOARD[promote_piece], i);
            set_bit(BOARD[14], i);
            if (promote_piece < 6) {
                set_bit(BOARD[12], i);
            } else {
                set_bit(BOARD[13], i);
            }
            display_board();
            setup_board();
            return;
        }
    }
}

function play_rand_endgame(book) {
    let endgames = [
        ["6k1/5p2/6p1/8/7p/8/6PP/6K1 b - - 0 0", "Black"], // 3p vs 2p
        ["3k4/2n2B2/1KP5/2B2p2/5b1p/7P/8/8 b - - 0 0", "White"], // 2B vs BN
        ["4R3/1k6/1p2P1p1/p7/4r3/1P1r4/1K6/2R5 w - - 0 0", "Equal"], // 2R vs 2R
        ["8/8/7k/8/8/8/5q2/3B2RK b - - 0 1", "Black"], // Q vs RB
        ["8/6k1/8/R7/7K/1P6/5r2/8 b - - 0 1", "Equal"], // R1P vs R                     #5
        ["8/7p/6p1/5k2/7N/8/4KP2/8 b - - 0 0", "Equal"], // N1P vs 2P                   
        ["6k1/3R4/5Kp1/6r1/4P3/8/8/8 b - - 0 0", "Equal"], // R1P vs R1P
        ["8/1k6/8/5NP1/8/2p3K1/8/r7 w - - 0 51", "Black"], // N1P vs R1P
        ["8/1r4k1/3R1ppp/1p6/2p4P/2P5/1P4PK/8 b - - 0 43", "Equal"], // R5P vs R4P
        ["1r6/8/p4kp1/P1KP3p/8/7P/4B1P1/8 b - - 0 43", "Equal"], // B4P v R3P           #10
        ["8/8/2R2pk1/3r3p/1P3P1K/8/7P/8 w - - 0 47", "Equal"], // R3P v R2P
        ["8/5pkp/1n4p1/1P6/3K2P1/2N4P/8/8 w - - 0 70", "White"], // N vs. N
        ["8/8/7B/8/8/3p4/6Kp/3k1n2 w - - 0 0", "Equal"], // B vs. N
        ["2r1r3/5k2/3p3p/pp6/4P1PP/3P3Q/1P6/7K w - - 0 34", "White"], // Q v RR
        ["8/pp2k3/2p3B1/3p2P1/3n2K1/8/PPP5/8 b - - 0 0", "White"], // B vs. N           #15
        ["3k4/2p2p2/1p5p/p1p1P1p1/P1Pn2P1/1P3P1P/1B3K2/8 w - - 0 30", "Equal"], // B vs. N
        ["6b1/6p1/8/5kPP/K7/P1P5/8/8 w - - 0 50", "Equal"], // B vs. 3p
        ["6k1/1p3pp1/p2np2p/P7/2P2P2/1P5P/4N1P1/6K1 w - - 0 36", "White"], // N vs. N
        ["1n6/4k2p/p3ppp1/1pPp4/3P1PP1/3NP3/P3K2P/8 w - - 0 27", "White"], // N+pawns vs. N+pawns
        ["8/8/8/pp1k1p2/7p/1PK1PP1P/8/8 w - - 0 52", "Equal"], // 4p vs. 4p             #20
        ["R7/8/8/8/6K1/5p2/5Pk1/4r3 w - - 0 1", "Equal"], // R+p vs. R+p
        ["8/8/8/p1k2K1R/5P1P/8/4p1n1/8 w - - 0 1", "Equal"], // R vs. N (2p)
        ["8/pp4pp/2pn1k2/3p1p2/3P1K2/6PP/PPP1B1P1/8 w - - 0 24", "Equal"], // B vs. N
        ["4n3/p3k3/1p4P1/2pK4/P2p4/1P6/2P1B3/8 w - - 0 49", "White"], // B vs. N
        ["8/5k2/4p2p/4P3/B1np1KP1/3b4/8/2B5 b - - 0 1", "Equal"], // B+N vs. 2B         #25
        ["8/1p4p1/5p1p/1k3P2/6PP/3KP3/8/8 w - - 0 50", "White"], // K+P
        ["8/8/1p1k4/5ppp/PPK1p3/6P1/5PP1/8 b - - 0 0", "Black"], // K+P
    ]
    let index = Math.floor(Math.random() * endgames.length);
    let fen = endgames[index][0];
    if (book) { fen = "6k1/8/8/8/8/8/8/4BNK1 w - - 0 0"; } // BN vs K 
    i = 0;
    while (i < fen.length) {
        if (fen[i] == " ") {
            PLAYER_WHITE = fen[i + 1] == "w";
            break;
        }
        i++;
    }
    document.getElementById("stored_fen").value = "";
    start_game(PLAYER_WHITE, fen, 8);
}

function undo_move() {
    GAME.pop();
    GAME.pop();
    BOARD = GAME[GAME.length - 1];
    if (!BOARD) { return start_game(PLAYER_WHITE); }

    GAME_MOVES.pop();
    GAME_MOVES.pop();
    GAME_HASH.pop();
    GAME_HASH.pop();

    display_board();
}

function copy_to_clipboard(text) {
    let dummy = document.createElement("textarea");
    document.body.appendChild(dummy);
    dummy.value = text;
    dummy.select();
    document.execCommand("copy");
    document.body.removeChild(dummy);
}

function open_chess_com() {
    open("https://www.chess.com/analysis?pgn=" + get_pgn());
}
function open_lichess() {
    open("https://www.lichess.org/paste?pgn=" + get_pgn());
}

function get_pgn() {
    let res = '[Event "?"][Site "?"][Date "????.??.??"][Round "?"][White "' + (PLAYER_WHITE ? 'WillyWonka"][Black "Computer' : 'Computer"][Black "WillyWonka') + '"][Result "*"]';
    let from_fen = document.getElementById("stored_fen").value;
    if (from_fen != START_FEN) { res += '[FEN "' + from_fen + '"]'; }
    return res + get_game_moves() + '*';
}

function get_fen() {
    let values = "PNBRQKpnbrqk";

    let castle = (get_castle_wk(CASTLE) ? "K" : "") + (get_castle_wq(CASTLE) ? "Q" : "") + (get_castle_bk(CASTLE) ? "k" : "") + (get_castle_bq(CASTLE) ? "q" : "");
    if (!castle.length) { castle = "-"; }
    let en_pass = EN_PASSANT_SQUARE ? square_index(EN_PASSANT_SQUARE) : "-";

    let res = ""; 
    let count = 0;
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            let p = (i << 3) + j;
            if (get_bit(BOARD[14], p)) {
                if (count) {
                    res += (count);
                }
                count = 0;
                for (let k = 0; k < 12; k++) {
                    if (get_bit(BOARD[k], p)) {
                        res += values[k];
                        break;
                    }
                }
            } else {
                count++;
            }
        }
        if (count) {
            res += (count);
        }
        count = 0;
        res += "/";
    }

    res = res.slice(0, res.length - 1) + " " + (TURN ? "b" : "w") + " " + castle + " " + en_pass + " 0 1";
    copy_to_clipboard(res);
    return res;
}

function get_game_moves() {
    let temp = "";
    for (let i = 0; i < GAME_MOVES.length; i++) {
        if (i % 2 == 0) {
            temp += String(Math.floor(i / 2) + 1) + "." + " ";
        } 
        temp += GAME_MOVES[i] + " ";
    }
    return temp;
}

function get_move_number() {
    return (GAME_MOVES.length >> 1) + 1;
}

function make_table() {
    let table = '<table id="chess-table" class="chess-board">';
    let row_order = PLAYER_WHITE ? "87654321" : "12345678";
    let col_order = PLAYER_WHITE ? "abcdefgh" : "hgfedcba";
    for (let row = 0; row < 8; row++) {
        table += '<tr>';
        for (let col = 0; col < 8; col++) {
            let colour_class = ((row + col) % 2) ? 'dark' : 'light';
            table += '<td id="s' + ((row << 3) + col) + '" class="' + colour_class + '">';
            if (col == 0) {
                table += '<div style="position: absolute; top: -1px; left: 0px;">' + row_order[row] + '</div>';
            }
            if (row == 7) {
                table += '<div style="position: absolute; bottom: -1px; right: 2px;">' + col_order[col] + '</div>';
            }
            table += '</td>';
        }
        table += '</tr>';
    }
    document.getElementById("chess-board").innerHTML = table;
}

function make_board(fen) {
    let res = new Array(64).fill(0);
    let split_fen = fen.split(" ");

    if (split_fen.length > 6 || 
        split_fen.length < 4 || 
        split_fen[0].split("/").length != 8 ||
        (!split_fen[1].includes("w") && !split_fen[1].includes("b"))) { return []; }

    let pieces = "PNBRQKpnbrqk";
    let row = 0;
    let col = 0;
    for (let i = 0; i < split_fen[0].length; i++) {
        let char = fen[i];
        if (char == "/") {
            row++;
            col = 0;
        } else if (!isNaN(char)) {
            col += parseInt(char);
        } else {
            res[(row << 3) + col] = pieces.indexOf(char) + 1;
            col++;
        }
    }

    TURN = split_fen[1] == "w" ? 0 : 1;
    CASTLE = 0;
    if (split_fen[2] != "-") {
        CASTLE = create_castle(split_fen[2]);
    }
    EN_PASSANT_SQUARE = 0;
    if (split_fen[3] != "-") { 
        EN_PASSANT_SQUARE = square_index(split_fen[3]);
    }
    return create_board(res);
}

// Piece position variables
let top_offset = 3;
let left_offset = 4;
let width;

function remove_img_div(div) {
    let i = 0;
    while (i < div.length - 2) {
        if (div.slice(i, i + 3) == "img") {
            let f = i - 2;
            while (f > 0 && div[f] != "<") {
                f--;
            }
            let l = i + 3;
            while (l < div.length && div[l] != "<") {
                l++;
            }
            return div.slice(0, f) + div.slice(l + "</div>".length, div.length);
        }
        i++;
    }
    return div;
}

function display_board() {
    let table = document.getElementById("chess-table");
    let s = document.getElementById("s0").getBoundingClientRect();
    width = s.right - s.left;

    for (let i = 0; i < 64; i++) {
        let piece_location = table.rows.item(i >> 3).cells.item(i % 8);
        piece_location.style.background = "";
        piece_location.innerHTML = remove_img_div(piece_location.innerHTML);
        
        let b = (PLAYER_WHITE) ? i : 63 - i;
        if (get_bit(BOARD[14], b)) {
            for (let j = 0; j < 12; j++) {
                if (get_bit(BOARD[j], b)) {
                    let piece = '<img draggable="false" style="width: ' + (width - 10) + 'px; height: ' + (width - 10) + 'px;" src="../imgs/chess_pieces/' + (j) + '.png">';
                    
                    let piece_div = document.createElement('div');
                    piece_div.id = i;
                    piece_div.className = "chess-piece";
                    piece_div.innerHTML = piece;
                    piece_location.appendChild(piece_div);

                    pieceDrag(piece_div, i, !((j < 6) ^ PLAYER_WHITE));
                    break;
                }
            }
        }
    }
}

function highlightLastMove(last_move) {
    let table = document.getElementById("chess-table");
    let lcode = "#B8E2F2"; let dcode = "#77C3EC";

    let move_source = get_move_source(last_move);
    let move_target = get_move_target(last_move);

    if (!PLAYER_WHITE) {
        move_source = 63 - move_source;
        move_target = 63 - move_target;
    }

    let s_location = table.rows.item(move_source >> 3).cells.item(move_source % 8);
    let t_location = table.rows.item(move_target >> 3).cells.item(move_target % 8);

    s_location.style.background = (s_location.className == "light") ? lcode : dcode;
    t_location.style.background = (t_location.className == "light") ? lcode : dcode;
}

let SELECTED_PIECE = 64;

function pieceDrag(div, pos, pieceTurn, move_anywhere=false) {   
    let pos1 = 0; let pos2 = 0; let pos3 = 0; let pos4 = 0;
    div.style.top = (top_offset) + "px";
    div.style.left = (left_offset) + "px";
    if (pieceTurn) { div.onmousedown = openDragElement; }

    function openDragElement(e) {
        e = e || window.event;
        pos3 = e.clientX;
        pos4 = e.clientY;

        // Reset board colours
        let table = document.getElementById("chess-table");
        for (let i = 0; i < 64; i++) {
            let piece_location = table.rows.item(i >> 3).cells.item(i % 8);
            if (piece_location.style.background != "rgb(184, 226, 242)" && piece_location.style.background != "rgb(119, 195, 236)") { // leave blue cells
                piece_location.style.background = "";
            }
            piece_location.onclick = null;
        }

        document.onmouseup = closeDragElement;
        document.onmousemove = dragElement;
    }

    function dragElement(e) {
        e = e || window.event;
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        div.style.top = (div.offsetTop - pos2) + "px";
        div.style.left = (div.offsetLeft - pos1) + "px";
    }

    function closeDragElement(e) {
        document.onmouseup = null;
        document.onmousemove = null;

        let row_diff = Math.round(div.offsetTop / width);
        let col_diff = Math.round(div.offsetLeft / width);
        let new_pos = pos + (row_diff << 3) + col_diff;
        div.style.top = (width * row_diff + top_offset) + "px";
        div.style.left = (width * col_diff + left_offset) + "px";
        
        if (move_anywhere) {
            // Get piece value
            let image = div.getElementsByTagName('img')[0].src;
            let i = image.length - 1;
            while (i >= 0 && image[i] != "/") {
                i--;
            }
            let val = "";
            while (i < image.length && image[i] != ".") {
                i++;
                val += image[i];
            }
            val = parseInt(val);
            let m = create_move(pos, new_pos, val, 0, get_bit(BOARD[14], new_pos) ? 1 : 0);
            TURN = val < 6 ? 0 : 1;
            do_move(m, true);

            display_board();
            setup_board();
        } else if (pos == new_pos) {
            clickMovePiece();
        } else {
            if (!doLegalMove(new_pos)) { // reset piece position
                div.style.top = (top_offset) + "px";
                div.style.left = (left_offset) + "px";
            }
        }
    }

    function clickMovePiece() {
        let table = document.getElementById("chess-table");

        if (SELECTED_PIECE == pos) { return; } // remove selection

         // Highlight piece
         let piece_location = table.rows.item(pos >> 3).cells.item(pos % 8);
         piece_location.style.background = (piece_location.className == "light") ? "#bbe0ae" : "#75c15b";

        // Determine legal piece moves
        let moves = generate_pseudo_moves();
        let move_targets = [];
        for (let i = 0; i < moves.length; i++) {
            if (get_move_source(moves[i]) == pos) {
                move_targets.push(get_move_target(moves[i]));
            }
        }

        // Add onclick for doing nothing
        for (let i = 0; i < 64; i++) {
            let cell = table.rows.item(i >> 3).cells.item(i % 8);
            if (i == pos) { continue; }
            cell.onclick = function() {
                SELECTED_PIECE = 64;
                if (get_bit(BOARD[14], i)) { SELECTED_PIECE = i; }
                // Reset board colours
                for (let j = 0; j < 64; j++) {
                    let piece_location = table.rows.item(j >> 3).cells.item(j % 8);
                    if (piece_location.style.background != "rgb(184, 226, 242)" && piece_location.style.background != "rgb(119, 195, 236)") { // leave blue cells
                        piece_location.style.background = (piece_location.className == "light") ? "#f1d9c0" : "#a97a65";
                    }
                    piece_location.onclick = null;
                }
            }
        }

        // Add onclick for legal piece moves
        for (let i = 0; i < move_targets.length; i++) {
            let target = move_targets[i];
            let move_location = table.rows.item(target >> 3).cells.item(target % 8);

            move_location.onclick = function() {
                SELECTED_PIECE = 64;
                doLegalMove(target);
            }
        }
    }

    function doLegalMove(new_pos) {
        let source = PLAYER_WHITE ? pos : 63 - pos;
        let target = PLAYER_WHITE ? new_pos : 63 - new_pos;
        let res = legal_move(source, target);
        let move = res[0]; 
        let moves = res[1];
        if (move) {
            if (get_move_promote(move)) { // ask for promote input
                move |= 983040; // set promote 15
            }
            if (do_move(move)) {
                GAME.push(copy_board(BOARD));
                GAME_MOVES.push(get_move_san(move, moves));
                GAME_HASH.push(copy_bitboard(hash_key));

                document.getElementById("loading").innerHTML = "LOADING";
                
                setTimeout(() => {  
                    document.getElementById("loading").innerHTML = "";
                    display_board(move); 
                    doAiMove();
                }, 250);
                return true;
            }
            let king_pos = lsb_index(BOARD[TURN ? 11 : 5]);
            let king_location = document.getElementById("chess-table").rows.item(king_pos >> 3).cells.item(king_pos % 8);
            king_location.style.background = "#FF0000"; // RED
            setTimeout(() => {
                king_location.style.background = "";
            }, 250);
        }
        return false;
    }
}

function doAiMove() {
    let res = search();
    let evaluation = res[0]; 

    let best_move = pv_table[0][0];
    let moves = generate_pseudo_moves();

    if (!do_move(best_move)) {
        finish();
        return false;
    }

    GAME.push(copy_board(BOARD));
    GAME_MOVES.push(get_move_san(best_move, moves));
    GAME_HASH.push(copy_bitboard(hash_key));

    evaluation = Math.round(evaluation + Number.EPSILON);
    if (Math.abs(evaluation) > 99900) {
        if (Math.abs(evaluation) == 99999) { setTimeout(() => {  return finish(); }, 250); }
        evaluation = (evaluation < 0 ? "-" : "") + "M" + ((100000 - Math.abs(evaluation)) / 2 << 0);
        if (evaluation.includes("-")) {
            document.getElementById("black-eval").innerText = evaluation;
            document.getElementById("white-eval").innerText = "";
            evaluation = -99;
        }  else {
            document.getElementById("black-eval").innerText = "";
            document.getElementById("white-eval").innerText = evaluation;
            evaluation = 99;
        }

    } else {
        evaluation /= 100; 
        evaluation = Math.round((evaluation + Number.EPSILON) * 10) / 10;
        if (Math.abs(evaluation).toString().length > 3) { evaluation = Math.round(evaluation); }
        
        if (evaluation >= 0) { // white winning
            document.getElementById("black-eval").innerText = "";
            document.getElementById("white-eval").innerText = evaluation;
        } else { // if (evaluation < 0) {
            document.getElementById("black-eval").innerText = Math.abs(evaluation);
            document.getElementById("white-eval").innerText = "";
        }
    }
    if (PLAYER_WHITE) { evaluation *= -1; }
    document.getElementById("eval-bar").style.height = Math.min(Math.max(56 * Math.tanh(evaluation / 5) + 50, 0), 100) + "%";

    if (is_repetition()) { setTimeout(() => {  return finish(); }, 250); }
    display_board();
    highlightLastMove(best_move);

    return true;
}

function import_fen() {
    let fen = prompt("Enter fen:");
    if (fen) {
        let test_board = make_board(fen);
        if (!test_board || test_board.length == 0) {
            alert("Invalid fen");
            document.getElementById("stored_fen").value = "";
            start_game(true);
            return;
        }
        start_game(!TURN, fen);
    }
}

// API ----------------------------------------------------------------------------------------------------------------------

const post_anything = (url) => {
    fetch("https://lichess.org/api/" + url, {
        method: "GET",
        headers: { "Authorization": `Bearer ${lichessToken}`}
    })
        .then(response => response.json())
        .then(data => data["nowPlaying"][0]["fen"])
}

const get_tablebase = async () => {
    let res = await fetch('https://tablebase.lichess.ovh/standard?fen=' + get_fen().replaceAll(" ", "_"), {
        method: "GET",
    })
        .then(response => response.json())
        .then(data => {
            if (data["category"] != "unknown") {
                return data["moves"][0];
            }
            return 0;
        })
    if (res) { 
        let eval = 0;
        if (res["category"] == "win" || res["category"] == "loss") {
            eval = 1000;
        }
        let move = create_move_uci(res["uci"]);
    }
}

const post_human_move = (move) => {
    fetch("https://lichess.org/api/board/game/" + STOCKFISH_ID + "/move/" + move, {
        method: "POST",
        headers: { "Authorization": `Bearer ${lichessToken}` }
    })
}

let STOCKFISH_ID;

const play_stockfish = (fen=START_FEN) => {
    let data = new FormData();
    data.append('level', 8);
    data.append('color', fen.includes('w') ? 'white' : 'black')
    data.append('fen', fen)
    fetch("https://lichess.org/api/challenge/ai", {
        method: "POST",
        body: data,
        headers: { "Authorization": `Bearer ${lichessToken}` }
    })
        .then(response => response.json())
        .then(data => {
            STOCKFISH_ID = data['id'];
        })
}

const import_pgn = (pgn) => {
    let data = new FormData();
    data.append('pgn', pgn);
    fetch("https://lichess.org/api/import", {
        method: "POST",
        body: data,
        headers: { "Authorization": `Bearer ${lichessToken}` }
    })
        .then(response => response.json())
        .then(data => open(data["url"]))
}

const daily_puzzle = () => {
    fetch("https://lichess.org/api/puzzle/daily", {
        method: "GET",
        headers: { "Authorization": `Bearer ${lichessToken}`}
    })
        .then(response => response.json())
        .then(data => {
            console.log(data)
            console.log(data["game"]["pgn"])
        })
}

// MAIN ----------------------------------------------------------------------------------------------------------------------

function prepare_game(whiteDown, fen) {
    GAME = [];
    GAME_HASH = [];
    GAME_MOVES = [];

    PLAYER_WHITE = whiteDown;
    STOCKFISH_ID = "";

    make_table();
    BOARD = make_board(fen);
    hash_key = init_hash();
    HASH_TABLE = new HashTable();

    document.getElementById("setup").style.backgroundColor = "";

    // Setup eval bar
    if (PLAYER_WHITE && document.getElementById("black-eval").style.position) {
        document.getElementById("eval-container").style.backgroundColor = "white";
        document.getElementById("eval-bar").style.backgroundColor = "black";
        let temp = document.getElementById("white-eval");
        document.getElementById("black-eval").id = "white-eval";
        temp.id = "black-eval";

        document.getElementById("white-eval").style.color = "black";
        document.getElementById("black-eval").style.color = "white";
    } else if (!PLAYER_WHITE && document.getElementById("white-eval").style.position) {
        document.getElementById("eval-container").style.backgroundColor = "black";
        document.getElementById("eval-bar").style.backgroundColor = "white";
        let temp = document.getElementById("white-eval");
        document.getElementById("black-eval").id = "white-eval";
        temp.id = "black-eval";

        document.getElementById("white-eval").style.color = "black";
        document.getElementById("black-eval").style.color = "white";
    }

    display_board();
}

function start_game(whiteDown, fen=START_FEN) {
    let stored_fen = document.getElementById("stored_fen").value;
    if (fen == START_FEN && stored_fen) { fen = stored_fen; }
    if (!fen) { fen = START_FEN; } 
    document.getElementById("stored_fen").value = fen;

    prepare_game(whiteDown, fen);

    if (!(TURN ^ PLAYER_WHITE)) {
        doAiMove();
    }
}

let START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

let PAWN_ATTACK;
let KNIGHT_ATTACK;
let KING_ATTACK;

let ROW_MASKS; 
let COL_MASKS;

let PLAYER_WHITE;
let TURN; // 0 for player, 1 for ai
let CASTLE;
let EN_PASSANT_SQUARE; // pawn moves 2 spots, record position behind pawn

let BOARD;
let GAME; // for easy undo move
let GAME_HASH;
let GAME_MOVES;

initialise_constants();

let tricky_fen = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
start_game(true);

/*
    AI (WHITE) vs AI2 (BLACK)  ->  AI2 has no endgame evaluation
    BLACK WINS!
    1. e4 Nc6 2. d4 { B00 Nimzowitsch Defense } e6 3. Bb5 a6 4. Bxc6 bxc6 5. Nf3 Nf6 6. Nbd2 d5 7. e5 Nd7 8. O-O Be7 9. Nb3 Nb6 10. Na5 Bd7 11. Qd3 O-O 12. Be3 Rb8 13. Rac1 Bb4 14. Nb3 Nc4 15. Ng5 g6 16. a3 Be7 17. f4 Nxb2 18. Qxa6 Nc4 19. Rce1 Ra8 20. Qb7 Nxa3 21. Rc1 h6 22. Nf3 Nxc2 23. Rxc2 Rb8 24. Qa6 Rxb3 25. Re1 Re8 26. Nd2 Ra3 27. Qb7 Bh4 28. g3 Be7 29. Nb3 Kh8 30. Nc5 Bxc5 31. Rxc5 Ra2 32. Qb3 Qa8 33. h4 Rb8 34. Qd3 Rbb2 35. f5 Rg2+ 36. Kh1 Rh2+ 37. Kg1 Rag2+ 38. Kf1 Qa2 39. Re2 Rxe2 40. Rc2 Qb1+ 41. Bc1 Rxc2 42. Qxc2 Rxc2 43. fxg6 Qxc1# { Black wins by checkmate. } 0-1

    AI (WHITE) vs AI2 (BLACK)  ->  AI2 only addded delta pruning, increased capture search
    WHITE WINS!
    1. e4 Nc6 2. d4 { B00 Nimzowitsch Defense } e6 3. Bb5 a6 4. Bxc6 bxc6 5. Nf3 Nf6 6. Nbd2 d5 7. e5 Nd7 8. O-O Be7 9. Nb3 Nb6 10. Na5 Bd7 11. Qd3 O-O 12. Be3 c5 13. dxc5 Bb5 14. Qc3 Na4 15. Qa3 Bxf1 16. Rxf1 Qe8 17. b4 f6 18. Nd4 fxe5 19. Nxe6 d4 20. Nxc7 Qd7 21. Nxa8 dxe3 22. Qxe3 Rxa8 23. Qb3+ Kh8 24. c6 Qg4 25. Qxa4 Qxb4 26. Qxb4 Bxb4 27. Nc4 Rc8 28. Rb1 a5 29. a3 Bf8 30. Nxa5 Bc5 31. Rb5 Bxa3 32. Nc4 Bf8 33. Nxe5 Kg8 34. Rd5 Ra8 35. g4 Rc8 36. Rd7 Bc5 37. g5 Bb6 38. Kg2 Rf8 39. Nd3 Rc8 40. Ne5 Rf8 41. Nd3 Rc8 42. Nb4 Kf8 43. Rd5 Re8 44. Rb5 Bc7 45. Na6 Rc8 46. Rb7 Ba5 47. Rb5 Bd2 48. c7 Ke7 49. Kf3 h6 50. g6 Bc3 51. Ke4 Kd6 52. Rb8 Kd7 53. Kd5 Rxc7 54. Nxc7 Kxc7 55. Rf8 Kb6 56. h4 Kb5 57. Rb8+ Ka6 58. h5 Ka5 59. f4 Ka6 60. Rc8 Bb2 61. c4 Kb7 62. Rf8 Bc3 63. f5 Ka7 64. f6 Bxf6 65. Rxf6 gxf6 66. g7 f5 67. g8=Q Kb7 68. Kc5 f4 69. Qf7+ Ka8 70. Qg8+ Kb7 71. Qf7+ Ka8 72. Qg8+ Kb7 *

    AI (BLACK) vs AI2 (WHITE)  -> same as above
    BLACK WINS!
    1. Nf3 d5 2. d4 Nf6 { D02 Queen's Pawn Game: Symmetrical Variation } 3. Nc3 Nc6 4. Bf4 e6 5. e3 Bb4 6. Bd3 Ne4 7. Bxe4 dxe4 8. Nd2 f5 9. Rf1 O-O 10. Nc4 b6 11. a3 Bxc3+ 12. bxc3 Ba6 13. Ne5 Nxe5 14. Bxe5 Bxf1 15. Kxf1 c5 16. dxc5 Qxd1+ 17. Rxd1 bxc5 18. Rd6 Rad8 19. Rxe6 Rd1+ 20. Ke2 Rfd8 21. Bd4 Rc1 22. Bxc5 Rxc2+ 23. Ke1 Rb8 24. Rd6 Rb1+ 25. Rd1 Rxd1+ 26. Kxd1 Rxf2 27. g3 *
*/