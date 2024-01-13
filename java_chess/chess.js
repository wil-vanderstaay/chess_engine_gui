function square_index(name) { return name[0].charCodeAt() - (parseInt(name[1]) << 3) - 33; }
function square_name(index) { return String.fromCharCode((index & 7) + 97) + (8 - (index >> 3)) }

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
    let enpassant = !(piece % 6) && Math.abs((source & 7) - (target & 7)) == 1 && !get_bit(BOARD[14], target);
    let capture = (enpassant || get_bit(BOARD[14], target)) ? 1 : 0;
    let castle = piece % 6 == 5 && Math.abs((source & 7) - (target & 7)) == 2;
    return create_move(source, target, piece, promote, capture, double, enpassant, castle);
}
function create_move_san(san) {
    san = san.replace("+", "");
    let is_promote = san.includes("=");
    let is_pawn = san[0] != san[0].toUpperCase();
    let letters = " NBRQK";

    let target_index = is_promote ? san.length - 4 : san.length - 2;
    let target;
    let piece;
    let castle = san.includes("O") ? 1 : 0;
    if (castle) {
        target = TURN ? 2 : 58;
        if (san.length == 3) { target += 4; }
        piece = 5;
    } else {
        target = square_index(san[target_index] + san[target_index + 1]);
        piece = is_pawn ? 0 : letters.indexOf(san[0]);
    }
    let promote = is_promote ? letters.indexOf(san[san.length - 1]) : 0;
    if (TURN) {
        piece += 6;
        if (promote) { 
            promote += 6; 
        }
    }
    let capture = san.includes("x") ? 1 : 0;
    let enpassant = (capture && !get_bit(BOARD[14], target)) ? 1 : 0;

    let source;
    let bitboard;
    switch (piece % 6) {
        case 0: { 
            if (capture) {
                bitboard = and_bitboards(PAWN_ATTACK[TURN ^ 1][target], BOARD[piece]);
            } else {
                bitboard = and_bitboards(COL_MASKS[target], BOARD[piece]);
                if (count_bits(bitboard) != 1) { // disambiguate 2 pawns in same column
                    let row_back = TURN ? -8 : 8;
                    if (get_bit(bitboard, target + row_back)) {
                        bitboard = [0, 0];
                        set_bit(bitboard, target + row_back);
                    } else if (get_bit(bitboard, target + (row_back << 1))) {
                        bitboard = [0, 0];
                        set_bit(bitboard, target + (row_back << 1));
                    }
                }
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
            if (castle) {
                bitboard = [0, 0];
                set_bit(bitboard, san.length == 3 ? target - 2 : target + 2);
            } else {
                bitboard = and_bitboards(KING_ATTACK[target], BOARD[piece]);
            }
            break;
        }
    }
    if (count_bits(bitboard) == 1) {
        source = lsb_index(bitboard);
    } else { // ambiguous moves eg. Nde2
        let ambig = is_pawn ? san[0] : san[1];
        let mask = isNaN(ambig) ? COL_MASKS[ambig.charCodeAt() - 97] : ROW_MASKS[(8 - parseInt(ambig)) << 3];
        bitboard = and_bitboards(bitboard, mask);
        if (count_bits(bitboard) == 1) {
            source = lsb_index(bitboard);
        } else {
            source = square_index(san[1] + san[2]); // double ambiguous moves eg. Nb4d5
        }
    }
    let double = (is_pawn && Math.abs((source >> 3) - (target >> 3)) == 2) ? 1 : 0;
    return create_move(source, target, piece, promote, capture, double, enpassant, castle);
}
function get_move_source(move) { return move & 63; }
function get_move_target(move) { return (move & 4032) >> 6; }
function get_move_piece(move) { return (move & 61440) >> 12; }
function get_move_promote(move) { return (move & 983040) >> 16; }
function get_move_capture(move) { return move & 1048576; }
function get_move_double(move) { return move & 2097152; }
function get_move_enpassant(move) { return move & 4194304; }
function get_move_castle(move) { return move & 8388608; }
function get_move_uci(move) { 
    if (!move) { return ""; }
    let letters = " nbrq";
    let promote = get_move_promote(move) % 6;
    return square_name(get_move_source(move)) + square_name(get_move_target(move)) + (promote ? letters[promote] : ""); 
}
function get_move_san(move, disambiguate=true) { 
    if (!move) { return ""; }
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

    if (disambiguate) {
        let disamb = [];
        let moves = generate_pseudo_moves();
        for (let i = 0; i < moves.length; i++) {
            let m = moves[i];
            if (m != move && piece % 6 && get_move_piece(m) == piece && get_move_target(m) == target) {
                disamb.push(m);
            }
        }
        let same_row = false; let same_col = false;
        for (let i = 0; i < disamb.length; i++) {
            let ms = get_move_source(disamb[i]);
            if ((ms >> 3) == (source >> 3)) { same_row = true; }    
            else if ((ms & 7) == (source & 7)) { same_col = true; }   
        }
        if (same_col && same_row) { res += uci[0] + uci[1]; } // disamb by square
        else if (same_row) { res += uci[0]; }
        else if (same_col) { res += uci[1]; }
        else if (disamb.length) { res += uci[0]; } // disamb by rows otherwise
    }

    if (capture) { res += "x"; }
    res += square_name(target);
    if (promote) { 
        res += "=";
        if (promote != 15) {
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
function update_castle(source, target) {
    hash_key = xor_bitboards(hash_key, ZOB_TABLE[65][CASTLE]);
    CASTLE &= CASTLING_RIGHTS[source];
    CASTLE &= CASTLING_RIGHTS[target];
    hash_key = xor_bitboards(hash_key, ZOB_TABLE[65][CASTLE]);
}

function print_castle(castle) {
    console.log(get_castle_wk(castle) + " " + get_castle_wq(castle) + ", " + get_castle_bk(castle) + " " + get_castle_bq(castle));
}
function get_castle_wk(castle) { return castle & 1; }
function get_castle_wq(castle) { return castle & 2; }
function get_castle_bk(castle) { return castle & 4; }
function get_castle_bq(castle) { return castle & 8; }
    
// BITBOARD ----------------------------------------------------------------------------------------------------------------------
/*
    A list of 2 32-bit numbers to represent the board (due to javascript number limitations)
    First number for top 32 squares, second number for bottom 32 squares
*/
function sub_bitboards(bitboard1, bitboard2) { // subtract as if were 2 64-bit numbers
    if (bitboard1[0] - bitboard2[0] < 0) {
        return [bitboard1[0] - bitboard2[0] + 16, bitboard1[1] - bitboard2[1] - 1];
    }
    return [bitboard1[0] - bitboard2[0], bitboard1[1] - bitboard2[1]];
}
function sub_bit(bitboard, i) {
    let b = copy_bitboard(bitboard);
    for (; i < 64; i++) {
        if (get_bit(b, i)) { pop_bit(b, i); return b; }
        else { set_bit(b, i); }
    }
    return b;
}

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
    if (i & 32) {
        return (bitboard[1] & (1 << (i & 31))) ? 1 : 0;
    }
    return (bitboard[0] & (1 << i)) ? 1 : 0;
}
function set_bit(bitboard, i) { 
    if (i & 32) {
        bitboard[1] |= (1 << (i & 31));
    } else {
        bitboard[0] |= (1 << i);
    }
}
function pop_bit(bitboard, i) {
    let bit = get_bit(bitboard, i);
    if (bit) { bitboard[+(i >= 32)] ^= (1 << (i & 31)); }
    return bit;
}

function count_bits_number(number) {
	number -= (number >>> 1) & 0x55555555;
	number = (number & 0x33333333) + ((number >>> 2) & 0x33333333);
	return ((number + (number >>> 4) & 0xF0F0F0F) * 0x1010101) >>> 24;
}
function count_bits(bitboard) {
    return count_bits_number(bitboard[0]) + count_bits_number(bitboard[1]);
}

function lsb_index_number(number) {
    return count_bits_number((number & -number) - 1);
}
function lsb_index(bitboard) {
    if (bitboard[0]) {
        return lsb_index_number(bitboard[0]);
    }
    return 32 + lsb_index_number(bitboard[1]);
}
function pop_lsb_index(bitboard) {
    let index;
    if (bitboard[0]) {
        index = lsb_index_number(bitboard[0]);
        bitboard[0] &= bitboard[0] - 1;
    } else {
        index = 32 + lsb_index_number(bitboard[1]);
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

function copy_board() {
    return [[BOARD[0][0], BOARD[0][1]], [BOARD[1][0], BOARD[1][1]], [BOARD[2][0], BOARD[2][1]], [BOARD[3][0], BOARD[3][1]], [BOARD[4][0], BOARD[4][1]], [BOARD[5][0], BOARD[5][1]], [BOARD[6][0], BOARD[6][1]], [BOARD[7][0], BOARD[7][1]], [BOARD[8][0], BOARD[8][1]], [BOARD[9][0], BOARD[9][1]], [BOARD[10][0], BOARD[10][1]], [BOARD[11][0], BOARD[11][1]], [BOARD[12][0], BOARD[12][1]], [BOARD[13][0], BOARD[13][1]], [BOARD[14][0], BOARD[14][1]]];
}

function legal_move(pos, new_pos) { // determine if moving from pos to new_pos is a possible move
    let moves = generate_pseudo_moves();
    for (let i = 0; i < moves.length; i++) {
        let move = moves[i];
        if (get_move_source(move) == pos && get_move_target(move) == new_pos) {
            return move;
        }
    }
    return 0;
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

    let opp_colour = TURN ^ 1;
    let opp_start = opp_colour * 6;

    let curr_occ = 12 + TURN;
    let opp_occ = 12 + opp_colour;

    // Remove captured piece
    if (get_move_capture(move)) {
        for (let i = opp_start; i < opp_start + 6; i++) {     
            if (get_bit(BOARD[i], target)) {
                pop_bit(BOARD[i], target);
                pop_bit(BOARD[opp_occ], target);
                pop_bit(BOARD[14], target);
                hash_key = xor_bitboards(hash_key, ZOB_TABLE[target][i]);
                break;
            }
        }
    }

    // Move piece
    pop_bit(BOARD[piece], source);
    pop_bit(BOARD[curr_occ], source);
    pop_bit(BOARD[14], source);
    set_bit(BOARD[piece], target);
    set_bit(BOARD[curr_occ], target);
    set_bit(BOARD[14], target);
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
        let s = target + 8 - (TURN << 4);
        pop_bit(BOARD[opp_start], s);
        pop_bit(BOARD[opp_occ], s);
        pop_bit(BOARD[14], s);
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[s][opp_start]);


    // Perform castle 
    } else if (get_move_castle(move)) {
        let kingside = (target == 62) || (target == 6); 
        let rook_source = (kingside) ? target + 1 : target - 2;
        let rook_target = (kingside) ? target - 1 : target + 1;

        pop_bit(BOARD[piece - 2], rook_source);
        pop_bit(BOARD[curr_occ], rook_source);
        pop_bit(BOARD[14], rook_source);
        set_bit(BOARD[piece - 2], rook_target);
        set_bit(BOARD[curr_occ], rook_target);
        set_bit(BOARD[14], rook_target);
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[rook_source][piece - 2]);
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[rook_target][piece - 2]);
    } 
    
    // Re-validate hash key
    hash_key = xor_bitboards(hash_key, ZOB_TABLE[66][EN_PASSANT_SQUARE]);
    EN_PASSANT_SQUARE = get_move_double(move) ? target + 8 - (TURN << 4) : 0;
    hash_key = xor_bitboards(hash_key, ZOB_TABLE[66][EN_PASSANT_SQUARE]);   

    update_castle(source, target);

    // Moving into check, reset state
    if (!ignore_check && is_square_attacked(lsb_index(BOARD[6 * TURN + 5]), opp_colour)) {
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

    get(depth, alpha, beta, best_move) {
        let key = ((hash_key[0] % HASH_SIZE) + (hash_key[1] % HASH_SIZE)) % HASH_SIZE;
        let entry = this.hashes[key];
        if (entry != null && entry.first == hash_key[0] && entry.last == hash_key[1]) {
            if (entry.depth >= depth) {
                if (entry.flag == 1) { return entry.score; } // exact
                else if (entry.flag == 2 && entry.score <= alpha) { return alpha; } // alpha
                else if (entry.flag == 3 && entry.score >= beta) { return beta; } // beta
            }
            this.hashes[key].move = best_move;
        }
        return null;
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
        if (this.hashes[key] != null) { HASH_OVERWRITES++; } 
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
    let count = 0;
    for (let i = GAME_HASH.length - 1; i >= 0; i--) {
        let item = GAME_HASH[i];
        if (item[0] == hash_key[0] && item[1] == hash_key[1]) {
            count++;
            if (count >= 2) {
                return 1;
            }
        }
    }
    return 0;
    // return GAME_HASH.filter(x => x[0] == hash_key[0] && x[1] == hash_key[1]).length >= 3;
}

// DEFINE MOVES ----------------------------------------------------------------------------------------------------------------------

function initialise_constants() { // attack masks for pawns knights kings from any square 
    NUM_SQUARES_EDGE = squares_to_edge(); // [square][dir] (0 N, 1 E, 2 S, 3 W, 4 NE, 5 SE, 6 SW, 7 NW)
    DIR_OFFSETS = [-8, 1, 8, -1, -7, 9, 7, -9]; // [dir]
    PAWN_ATTACK = pawn_attack(); // [side][square]
    KNIGHT_ATTACK = knight_attack(); // [square]
    KING_ATTACK = king_attack(); // [square]

    init_zobrist();
    reset_search_tables();

    ROW_MASKS = new Array(64); 
    COL_MASKS = new Array(64);
    CENTRE_MANHATTAN = new Array(64);
    for (let i = 0; i < 8; i++) {
        let row = set_row_col_mask(i, -1);
        let col = set_row_col_mask(-1, i);
        for (let j = 0; j < 8; j++) {
            ROW_MASKS[(i << 3) + j] = row;
            COL_MASKS[(j << 3) + i] = col;
            CENTRE_MANHATTAN[(i << 3) + j] = Math.max(3 - i, i - 4) + Math.max(3 - j, j - 4);
        }
    }

    function squares_to_edge() {
        let res = new Array(64);
        for (let i = 0; i < 64; i++) {
            let r = i >> 3;
            let c = i & 7;
            res[i] = [
                r, 7 - c, 7 - r, c, 
                Math.min(r, 7 - c), Math.min(7 - c, 7 - r), Math.min(7 - r, c), Math.min(c, r)
            ];
        }
        return res;
    }
    function pawn_attack() {
        let res = [new Array(64), new Array(64)];
        for (let i = 0; i < 64; i++) { // player
            let board = [0, 0];           
            let col = i & 7;
            if (8 < i && 0 < col) { set_bit(board, i - 9); }
            if (6 < i && col < 7) { set_bit(board, i - 7); }
            res[0][i] = board;
        }
        for (let i = 0; i < 64; i++) { // ai
            let board = [0, 0]
            let col = i & 7;
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
    return sliding_moves(square, 4, 8, blocker);
    let res = [0, 0];
    let r = square >> 3; let c = square & 7;
    let o = 1;
    let i;
    while (r + o < 8 && c + o < 8) { // + +
        i = square + 9 * o;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (r + o < 8 && 0 <= c - o) { // + -
        i = square + 7 * o;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= r - o && c + o < 8) { // - +
        i = square - 7 * o;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= r - o && 0 <= c - o) { // - -
        i = square - 9 * o;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    return res;
}
function rook_attack_fly(square, blocker) {
    return sliding_moves(square, 0, 4, blocker);
    let res = [0, 0];
    let r = square >> 3; let c = square & 7;
    let o = 1;
    let i;
    while (r + o < 8) { // + .
        i = square + (o << 3);
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= r - o) { // - .
        i = square - (o << 3);
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (c + o < 8) { // . +
        i = square + o;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= c - o) { // . -
        i = square - o;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    return res;
}
function sliding_moves(square, start_dir_index, end_dir_index, blocker) {
    let res = [0, 0];
    for (; start_dir_index < end_dir_index; start_dir_index++) {
        let offset = DIR_OFFSETS[start_dir_index];
        let edge = NUM_SQUARES_EDGE[square][start_dir_index];
        for (let i = 0; i < edge; i++) {
            let target = square + offset * (i + 1);
            set_bit(res, target);
            if (get_bit(blocker, target)) { break; }
        }
    }
    return res;
}
function queen_attack_fly(square, blocker) {
    return sliding_moves(square, 0, 8, blocker);
    return or_bitboards(bishop_attack_fly(square, blocker), rook_attack_fly(square, blocker));
}

// GENERATE MOVES ----------------------------------------------------------------------------------------------------------------------

function is_square_attacked(square, side) {
    let att_piece = side * 6;
    // Attacked by pawns
    if (bool_bitboard(and_bitboards(PAWN_ATTACK[side ^ 1][square], BOARD[att_piece]))) { return 1; }
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

    let curr_occ = 12 + TURN;
    let opp_occ = 12 + (TURN ^ 1);

    while (bool_bitboard(piece_board)) {
        let source = pop_lsb_index(piece_board);
        let target = source + pawn_direction;

        let promote = target < 8 || target >= 56;
        let double = source < 16 || source >= 48;

        // Push
        if (!get_bit(BOARD[14], target)) {
            if (promote) { // promotion
                moves.push(create_move(source, target, piece, piece + 1)); // knight
                moves.push(create_move(source, target, piece, piece + 2)); // bishop
                moves.push(create_move(source, target, piece, piece + 3)); // rook
                moves.push(create_move(source, target, piece, piece + 4)); // queen
            } else {
                // One square push
                moves.push(create_move(source, target, piece));
                // Two square push
                if (double && !get_bit(BOARD[14], target + pawn_direction)) {
                    moves.push(create_move(source, target + pawn_direction, piece, 0, 0, 1));
                }
            }
        }

        // Capture
        let attacks = and_bitboards(PAWN_ATTACK[TURN][source], BOARD[opp_occ]);
        while (bool_bitboard(attacks)) {
            let att = pop_lsb_index(attacks);
            if (promote) { // Promote
                moves.push(create_move(source, att, piece, piece + 1, 1));
                moves.push(create_move(source, att, piece, piece + 2, 1));
                moves.push(create_move(source, att, piece, piece + 3, 1));
                moves.push(create_move(source, att, piece, piece + 4, 1));
            } else {
                moves.push(create_move(source, att, piece, 0, 1));
            }

        }
    }
    // En passant
    if (EN_PASSANT_SQUARE) {
        piece_board = and_bitboards(PAWN_ATTACK[TURN ^ 1][EN_PASSANT_SQUARE], BOARD[piece]);
        if (bool_bitboard(piece_board)) {
            let source = pop_lsb_index(piece_board);
            moves.push(create_move(source, EN_PASSANT_SQUARE, piece, 0, 1, 0, 1));
        }

    }
    // Knight moves
    piece++;
    piece_board = copy_bitboard(BOARD[piece]);
    while(bool_bitboard(piece_board)) {
        let source = pop_lsb_index(piece_board);
        let attacks = nand_bitboards(KNIGHT_ATTACK[source], BOARD[curr_occ]);
        while (bool_bitboard(attacks)) {
            let att = pop_lsb_index(attacks);
            moves.push(create_move(source, att, piece, 0, get_bit(BOARD[opp_occ], att)));
        }
    }
    // Bishop moves
    piece++;
    piece_board = copy_bitboard(BOARD[piece]);
    while(bool_bitboard(piece_board)) {
        let source = pop_lsb_index(piece_board);
        let attacks = nand_bitboards(bishop_attack_fly(source, BOARD[14]), BOARD[curr_occ]);
        while (bool_bitboard(attacks)) {
            let att = pop_lsb_index(attacks);
            moves.push(create_move(source, att, piece, 0, get_bit(BOARD[opp_occ], att)));
        }
    }
    // Rook moves
    piece++;
    piece_board = copy_bitboard(BOARD[piece]);
    while(bool_bitboard(piece_board)) {
        let source = pop_lsb_index(piece_board);
        let attacks = nand_bitboards(rook_attack_fly(source, BOARD[14]), BOARD[curr_occ]);
        while (bool_bitboard(attacks)) {
            let att = pop_lsb_index(attacks);
            moves.push(create_move(source, att, piece, 0, get_bit(BOARD[opp_occ], att)));
        }
    }
    // Queen moves
    piece++;
    piece_board = copy_bitboard(BOARD[piece]);
    while(bool_bitboard(piece_board)) {
        let source = pop_lsb_index(piece_board);
        let attacks = nand_bitboards(queen_attack_fly(source, BOARD[14]), BOARD[curr_occ]);
        while (bool_bitboard(attacks)) {
            let att = pop_lsb_index(attacks);
            moves.push(create_move(source, att, piece, 0, get_bit(BOARD[opp_occ], att)));
        }
    }
    // King moves
    piece++;
    piece_board = copy_bitboard(BOARD[piece]);
    // Normal moves
    let source = lsb_index(piece_board);
    let attacks = nand_bitboards(KING_ATTACK[source], BOARD[curr_occ]);
    while (bool_bitboard(attacks)) {
        let att = pop_lsb_index(attacks);
        moves.push(create_move(source, att, piece, 0, get_bit(BOARD[opp_occ], att)));
    }

    // Castling
    if (CASTLE) {
        let king_pos = TURN ? 4 : 60;
        if ((TURN ? get_castle_bk(CASTLE) : get_castle_wk(CASTLE)) && !get_bit(BOARD[14], king_pos + 1) && !get_bit(BOARD[14], king_pos + 2) && !is_square_attacked(king_pos, TURN ^ 1) && !is_square_attacked(king_pos + 1, TURN ^ 1)) {
            moves.push(create_move(king_pos, king_pos + 2, piece, 0, 0, 0, 0, 1));
        }
        if ((TURN ? get_castle_bq(CASTLE) : get_castle_wq(CASTLE)) && !get_bit(BOARD[14], king_pos - 1) && !get_bit(BOARD[14], king_pos - 2) && !get_bit(BOARD[14], king_pos - 3) && !is_square_attacked(king_pos, TURN ^ 1) && !is_square_attacked(king_pos - 1, TURN ^ 1)) {
            moves.push(create_move(king_pos, king_pos - 2, piece, 0, 0, 0, 0, 1));
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
    let index = 0;
    let moves = generate_pseudo_moves();
    for (let i = 0; i < moves.length; i++) {
        if (do_move(moves[i])) {
            index = 1;
            break;
        }
    }
    if (!index && is_square_attacked(lsb_index(BOARD[6 * TURN + 5]), TURN ^ 1)) {
        index = 2;
    }
    let outcomes = ["Draw by stalemate", "Draw by threefold repetition", "Checkmate. " + (TURN ? "White" : "Black") + " wins"];
    setTimeout(() => { alert(outcomes[index]); }, 250);
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

// START AI CODE -----------------------------------------------------------------------------------------------------------------------------------------------

function reset_search_tables() {
    COUNT = 0; 
    LOOKUP = 0;
    HASH_OVERWRITES = 0;
    ply = 0;
    follow_pv = 0; 
    score_pv = 0;

    killer_moves = [new Array(MAX_PLY).fill(0), new Array(MAX_PLY).fill(0)];
    history_moves = new Array(12); // piece, square
    for (let i = 0; i < 12; i++) { history_moves[i] = new Array(64).fill(0); }

    pv_length = new Array(MAX_PLY).fill(0); // ply
    pv_table = new Array(MAX_PLY); // ply, ply
    for (let i = 0; i < MAX_PLY; i++) { pv_table[i] = new Array(MAX_PLY).fill(0); }
}

// BOOK -----------------------------------------------------------------------------------------------------------------------------------------------

let book_games = [
    "1. d4 d6 2. c4 g6 3. Nc3 Bg7 4. e4",
    "1. d4 c5 2. d5 e5",
    "1. d4 Nf6 2. Bg5 Ne4",
    "1. d4 Nf6 2. Bg5 e6",
    "1. d4 Nf6 2. Bg5 d5",
    "1. d4 Nf6 2. Bg5 c5",
    "1. d4 Nf6 2. Bg5 g6",
    "1. d4 Nf6 2. Nf3 e6 3. Bg5",
    "1. d4 Nf6 2. Nf3 g6 3. Bg5",
    "1. d4 Nf6 2. Nf3 e6 3. Bf4",
    "1. d4 Nf6 2. Nf3 g6 3. Bf4",
    "1. d4 Nf6 2. c4 e6 3. g3 Bb4+",
    "1. d4 Nf6 2. c4 e6 3. g3 c5",
    "1. d4 Nf6 2. c4 e6 3. g3 d5 4. Bg2 dxc4",
    "1. d4 Nf6 2. c4 e6 3. g3 d5 4. Bg2 Be7 5. Nf3",
    "1. d4 Nf6 2. c4 Nc6",
    "1. d4 Nf6 2. c4 e5",
    "1. d4 Nf6 2. c4 d6",
    "1. d4 Nf6 2. c4 c5 3. d5 e5 4. Nc3 d6",
    "1. d4 Nf6 2. c4 c5 3. d5 b5",
    "1. d4 Nf6 2. c4 c5 3. d5 e6 4. Nc3 exd5 5. cxd5 d6 6. Nf3",
    "1. d4 Nf6 2. c4 c5 3. d5 e6 4. Nc3 exd5 5. cxd5 d6 6. e4",
    "1. d4 f5 2. c4 Nf6 3. g3 g6 4. Bg2 Bg7 5. Nf3 O-O 6. O-O",
    "1. d4 f5 2. c4 Nf6 3. g3 e6 4. Bg2",
    "1. d4 f5 2. c4 Nf6 3. Nc3",
    "1. d4 f5 2. Nc3",
    "1. d4 f5 2. Bg5",
    "1. d4 f5 2. e4",
    "1. d4 Nf6 2. c4 g6 3. g3 d5 4. Bg2 Bg7 5. Nf3 O-O 6. O-O",
    "1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. Nf3",
    "1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. Bf4",
    "1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. Bg5",
    "1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. e3",
    "1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. Qb3",
    "1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. cxd5 Nxd5 5. e4 Nxc3 6. bxc3 Bg7",
    "1. d4 Nf6 2. c4 e6 3. Nf3 Bb4+ 4. Bd2",
    "1. d4 Nf6 2. c4 e6 3. Nf3 Bb4+ 4. Nbd2",
    "1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. a3",
    "1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. Nc3",
    "1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. e3",
    "1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. Bg5",
    "1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. Bf4",
    "1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. g3 Ba6",
    "1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. g3 Bb7",
    "1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. g3 Bb4+",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Nf3",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. a3",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Bg5",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. f3",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. g3",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qb3",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Bd2",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 O-O",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 d5",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 Nc6",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 b6",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 d6",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 O-O",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 c5",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 b6",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 d5",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 Nc6",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 Bxc3+",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Be2 O-O 6. Bg5",
    "1. c4 Nf6 2. d4 g6 3. g3 Bg7 4. Bg2 d6 5. Nf3 O-O",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. f4",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. f3",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. Be3",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. dxe5",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. Bg5",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nbd7",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Na6",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O exd4",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O c6",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nh5",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Qe8",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. d5",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 Bg4",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 Nbd7",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 c6",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 c5",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. h3",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be3",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Bg5",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Bd3",
    "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. g3",
    "1. d4 d5 2. Bg5",
    "1. d4 d5 2. Nf3 Nf6 3. e3",
    "1. d4 d5 2. c4 c5",
    "1. d4 d5 2. c4 Bf5",
    "1. d4 d5 2. c4 e5",
    "1. d4 d5 2. c4 Nc6",
    "1. d4 d5 2. c4 c6 3. Nf3 dxc4",
    "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Qc2",
    "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Qb3",
    "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. g3",
    "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nbd2",
    "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. cxd5 cxd5 5. Nc3",
    "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 a6",
    "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. e4",
    "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. e3",
    "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. Ne5",
    "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. g3",
    "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 Bg4",
    "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 Na6",
    "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 e6",
    "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 Bf5",
    "1. d4 d5 2. c4 dxc4 3. e4",
    "1. d4 d5 2. c4 dxc4 3. Nf3 a6",
    "1. d4 d5 2. c4 dxc4 3. Nf3 c5",
    "1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. Nc3",
    "1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. Qa4+",
    "1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 Bg4",
    "1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 a6",
    "1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 g6",
    "1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 c5",
    "1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 e6 5. Bxc4 c5",
    "1. d4 d5 2. c4 e6 3. Nf3 c5",
    "1. d4 d5 2. c4 e6 3. Nc3 c6 4. e4",
    "1. d4 d5 2. c4 e6 3. Nc3 c6 4. Nf3 dxc4",
    "1. d4 d5 2. c4 e6 3. Nc3 c6 4. cxd5 exd5",
    "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 Nbd7",
    "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 Bb4",
    "1. d4 d5 2. c4 e6 3. Nc3 c5",
    "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. cxd5",
    "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 Be7 5. Bf4",
    "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 c5 5. e3 Nc6",
    "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 c5 5. cxd5",
    "1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. Nc3 c6 5. Qb3",
    "1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. Nc3 c6 5. Bf4",
    "1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. Nc3 c6 5. Bg5",
    "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 c6 5. e3",
    "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Nbd7",
    "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 c5",
    "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Bb4",
    "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7",
    "1. e4 b6",
    "1. e4 Nc6",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd6",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd8",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5",
    "1. e4 d5 2. exd5 Nf6 3. d4",
    "1. e4 d5 2. exd5 Nf6 3. c4",
    "1. e4 d5 2. exd5 Nf6 3. Bb5+",
    "1. e4 d5 2. exd5 Nf6 3. Nc3",
    "1. e4 d5 2. exd5 Nf6 3. Nf3",
    "1. e4 d5 2. exd5 Nf6 3. Bc4",
    "1. e4 Nf6 2. Nc3 d5",
    "1. e4 Nf6 2. e5 Nd5 3. c4",
    "1. e4 Nf6 2. e5 Nd5 3. Nc3",
    "1. e4 Nf6 2. e5 Nd5 3. Nf3",
    "1. e4 Nf6 2. e5 Nd5 3. Bc4",
    "1. e4 Nf6 2. e5 Nd5 3. g3",
    "1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. c4 Nb6 5. exd6",
    "1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. c4 Nb6 5. f4",
    "1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. Nf3",
    "1. e4 g6 2. d4 Bg7 3. Nf3",
    "1. e4 g6 2. d4 Bg7 3. Nc3 d6",
    "1. e4 g6 2. d4 Bg7 3. Nc3 c6",
    "1. e4 g6 2. d4 Bg7 3. Nc3 c5",
    "1. e4 g6 2. d4 Bg7 3. Nc3 a6",
    "1. e4 g6 2. d4 Bg7 3. Nc3 d5",
    "1. e4 g6 2. d4 Bg7 3. Nc3 Nc6",
    "1. e4 g6 2. d4 Bg7 3. c3",
    "1. e4 g6 2. d4 Bg7 3. f4",
    "1. e4 g6 2. d4 Bg7 3. Be3",
    "1. e4 g6 2. d4 Bg7 3. Bc4",
    "1. e4 d6 2. d4 Nf6 3. Bd3",
    "1. e4 d6 2. d4 Nf6 3. f3",
    "1. e4 d6 2. d4 Nf6 3. Nd2",
    "1. e4 d6 2. d4 Nf6 3. Nc3 c6",
    "1. e4 d6 2. d4 Nf6 3. Nc3 e5",
    "1. e4 d6 2. d4 Nf6 3. Nc3 Nbd7",
    "1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. f4",
    "1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3",
    "1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Bg5",
    "1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. f3",
    "1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. g3",
    "1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be2",
    "1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Nf3",
    "1. e4 c6 2. Nc3 d5 3. Nf3",
    "1. e4 c6 2. d4 d5 3. exd5 cxd5 4. Bd3",
    "1. e4 c6 2. d4 d5 3. exd5 cxd5 4. c4",
    "1. e4 c6 2. d4 d5 3. e5",
    "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nf6",
    "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nd7",
    "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5",
    "1. e4 e6 2. d3",
    "1. e4 e6 2. Nf3",
    "1. e4 e6 2. Qe2",
    "1. e4 e6 2. Nc3",
    "1. e4 e6 2. b3",
    "1. e4 e6 2. c4",
    "1. e4 e6 2. d4 d5 3. exd5",
    "1. e4 e6 2. d4 d5 3. e5 c5 4. c3",
    "1. e4 e6 2. d4 d5 3. Nd2 Nc6",
    "1. e4 e6 2. d4 d5 3. Nd2 Be7",
    "1. e4 e6 2. d4 d5 3. Nd2 a6",
    "1. e4 e6 2. d4 d5 3. Nd2 c5",
    "1. e4 e6 2. d4 d5 3. Nd2 Nf6",
    "1. e4 e6 2. d4 d5 3. Nc3 dxe4 4. Nxe4",
    "1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. Ne2",
    "1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. exd5",
    "1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. Bd3",
    "1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. a3",
    "1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. e5 Ne7",
    "1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. e5 b6",
    "1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. e5 Qd7",
    "1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. e5 c5",
    "1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. e5",
    "1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. Bg5 Bb4",
    "1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. Bg5 dxe4",
    "1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. Bg5 Be7",
    "1. e4 c5 2. d3",
    "1. e4 c5 2. b3",
    "1. e4 c5 2. c4",
    "1. e4 c5 2. g3",
    "1. e4 c5 2. Ne2",
    "1. e4 c5 2. Bc4",
    "1. e4 c5 2. b4",
    "1. e4 c5 2. f4",
    "1. e4 c5 2. d4 cxd4 3. c3",
    "1. e4 c5 2. c3 e6",
    "1. e4 c5 2. c3 d6",
    "1. e4 c5 2. c3 e5",
    "1. e4 c5 2. c3 Nc6",
    "1. e4 c5 2. c3 d5",
    "1. e4 c5 2. c3 Nf6",
    "1. e4 c5 2. Nc3 e6",
    "1. e4 c5 2. Nc3 d6",
    "1. e4 c5 2. Nc3 Nc6 3. f4",
    "1. e4 c5 2. Nc3 Nc6 3. Nf3",
    "1. e4 c5 2. Nc3 Nc6 3. Nge2",
    "1. e4 c5 2. Nc3 Nc6 3. Bb5",
    "1. e4 c5 2. Nc3 Nc6 3. g3",
    "1. e4 c5 2. Nf3 g6",
    "1. e4 c5 2. Nf3 a6",
    "1. e4 c5 2. Nf3 Nf6",
    "1. e4 c5 2. Nf3 Nc6 3. Bb5",
    "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Qc7",
    "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Qb6",
    "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 e5",
    "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6",
    "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6",
    "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 Qb6",
    "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 g6",
    "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e5 6. Ndb5 d6",
    "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 a6 5. Be2",
    "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 a6 5. Be3",
    "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 a6 5. g3",
    "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 a6 5. c4",
    "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 a6 5. Nc3",
    "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 a6 5. Bd3",
    "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6 5. Be3",
    "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6 5. Nxc6",
    "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6 5. c4",
    "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6 5. Be2",
    "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6 5. g3",
    "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6 5. Nb5",
    "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6 5. Nc3",
    "1. e4 c5 2. Nf3 d6 3. Bb5+",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Qxd4",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. g3",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. f4",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. f3",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Bg5",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be2",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Bc4",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 Nc6 6. Be2",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 Nc6 6. Be3",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 Nc6 6. f3",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 Nc6 6. g3",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 Nc6 6. f4",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 Nc6 6. Bc4",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 Nc6 6. Bg5",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e6",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. a4",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. g3",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. f3",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. f4",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Bc4",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be2",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Bg5",
    "1. e4 e5 2. d4 exd4",
    "1. e4 e5 2. Bc4",
    "1. e4 e5 2. f4",
    "1. e4 e5 2. Nc3",
    "1. e4 e5 2. Nf3 f5",
    "1. e4 e5 2. Nf3 d5",
    "1. e4 e5 2. Nf3 d6",
    "1. e4 e5 2. Nf3 Nf6 3. Nc3",
    "1. e4 e5 2. Nf3 Nf6 3. d4",
    "1. e4 e5 2. Nf3 Nf6 3. d3",
    "1. e4 e5 2. Nf3 Nf6 3. Bc4",
    "1. e4 e5 2. Nf3 Nf6 3. Nxe5 d6 4. Nf3 Nxe4",
    "1. e4 e5 2. Nf3 Nc6 3. c3",
    "1. e4 e5 2. Nf3 Nc6 3. Nc3 Bc5",
    "1. e4 e5 2. Nf3 Nc6 3. Nc3 g6",
    "1. e4 e5 2. Nf3 Nc6 3. Nc3 d6",
    "1. e4 e5 2. Nf3 Nc6 3. Nc3 Bb4",
    "1. e4 e5 2. Nf3 Nc6 3. Nc3 Nf6",
    "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. c3",
    "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Bc4",
    "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Qh4",
    "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nxd4",
    "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Qf6",
    "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Bb4+",
    "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 d6",
    "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 g6",
    "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6",
    "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Bc5",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Be7",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 d6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nd4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 g6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nge7",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Bc5",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 f5",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. d4 Nd6 6. Bxc6 dxc6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 d6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. d3",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. d4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. Qe2",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Nxe4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Bc5",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O d6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O b5 6. Bb3 Bb7",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Bxc6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Qe2",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. d4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. d3",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Nc3",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. a4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. h3",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. d4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. d3",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d5",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. d4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. d3",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. a4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nd7",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 h6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Be6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Bb7",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Na5 10. Bc2 c5",
    "1. c4 b6",
    "1. c4 f5",
    "1. c4 c6",
    "1. c4 g6",
    "1. c4 c5 2. Nf3 Nf6 3. g3 b6 4. Bg2 Bb7 5. O-O g6",
    "1. c4 c5 2. Nf3 Nf6 3. g3 b6 4. Bg2 Bb7 5. O-O e6",
    "1. c4 c5 2. Nf3 Nf6 3. d4",
    "1. c4 c5 2. Nc3 Nf6 3. Nf3 e6",
    "1. c4 c5 2. Nc3 Nf6 3. Nf3 d5",
    "1. c4 c5 2. Nc3 Nf6 3. Nf3 g6",
    "1. c4 c5 2. Nc3 Nf6 3. Nf3 b6",
    "1. c4 c5 2. Nc3 Nf6 3. Nf3 Nc6",
    "1. c4 c5 2. Nc3 Nc6 3. g3 g6 4. Bg2 Bg7",
    "1. c4 e6 2. Nf3 d5",
    "1. c4 e6 2. Nc3 d5",
    "1. c4 e6 2. Nc3 Nf6 3. e4",
    "1. c4 e6 2. Nc3 Nf6 3. Nf3",
    "1. c4 e5 2. g3",
    "1. c4 e5 2. Nc3 d6",
    "1. c4 e5 2. Nc3 Bb4",
    "1. c4 e5 2. Nc3 Nf6 3. Nf3 Nc6",
    "1. c4 e5 2. Nc3 Nf6 3. g3",
    "1. c4 e5 2. Nc3 Nc6",
    "1. c4 Nf6 2. g3",
    "1. c4 Nf6 2. Nf3 g6 3. g3 Bg7 4. Bg2 O-O",
    "1. c4 Nf6 2. Nc3 g6",
    "1. Nf3 d5 2. b3",
    "1. Nf3 d5 2. c4",
    "1. Nf3 d5 2. g3",

    // Scandinavian
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Bd7",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Be6",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 e6",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 c6",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nc6",

    // Ruy lopez berlin
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. d4 Nd6 6. Bxc6 dxc6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. d4 Nd6 6. dxe5 Nxb5",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. d4 Nd6 6. Ba4 exd4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. d4 a6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. d4 Be7",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Be7",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Bc5 5. Nxe5 Nxe5",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Bc5 5. Nxe5 Nxe4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Bc5 5. c3 O-O",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Bc5 5. c3 Bb6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Bc5 5. c3 Nxe4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. d3 Bc5 5. c3 O-O",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. d3 Bc5 5. Nbd2 O-O",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. d3 d6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. d3 Bd6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. Nc3 Bb4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. Nc3 Nd4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. Nc3 Bc5",

    // Ruy lopez morphy
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. d3 b5",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 11. Rxe5 c6 12. d4 Bd6 13. Re1 Qh4 14. g3 Qh3 15. Be3",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 11. Rxe5 c6 12. d4 Bd6 13. Re1 Qh4 14. g3 Qh3 15. Re4 g5 16. Qf1 Qxf1",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 11. Rxe5 c6 12. d4 Bd6 13. Re1 Qh4 14. g3 Qh3 15. Re4 g5 16. Qf1 Qh5",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 11. Rxe5 c6 12. d4 Bd6 13. Re1 Qh4 14. g3 Qh3 15. Bxd5 cxd5 16. Qf3 Bf5",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 11. Rxe5 c6 12. d4 Bd6 13. Re1 Qh4 14. g3 Qh3 15. Bxd5 cxd5 16. Qf3 Bg4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. h3 Bb7",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. a4 b4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. a4 Bb7",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O b5 6. Bb3 Bb7",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O b5 6. Bb3 Bc5",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O b5 6. Bb3 Be7",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Nxe4 6. d4 b5 7. Bb3 d5 8. dxe5 Be6",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Nxe4 6. d4 b5 7. Bb3 d5 8. Nxe5 Nxe5",

    // Italian
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. O-O",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. Nbd2",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. c3",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 exd4 5. Nxd4 Nxd4 6. Qxd4 Bd6",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 exd4 5. Nxd4 Nxd4 6. Qxd4 d6",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 exd4 5. Nxd4 Nxd4 6. Qxd4 d5",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 exd4 5. Nxd4 Nxe4 6. Nxc6 bxe6",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 exd4 5. Nxd4 Nxe4 6. Nxc6 dxe6",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 exd4 5. Nxd4 Nxe4 6. O-O d5 7. Bb5 Bd7",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 exd4 5. Nxd4 Nxe4 6. O-O d5 7. Bb3 Nxd4",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 exd4 5. Nxd4 Nxe4 6. O-O d5 7. Re1 Nxd4",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 d6 5. Nc3 Bg4",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 d6 5. O-O Bg4",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 Nxe4 5. dxe5 d6",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 Nxe4 5. d5 Nd6",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 Nxe4 5. Nxe5 d5",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Nc3 Nxe4",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Nc3 Bc5",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Nc3 Bb4",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 d6",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Bb6",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O Nf6",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O d6",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O Bb6",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 d6",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 Nf6",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 h6",
    
    // Alapin sicilian
    "1. e4 c5 2. c3 Nf6 3. e5 Nd5 4. Nf3",
    "1. e4 c5 2. c3 Nf6 3. e5 Nd5 4. d4 cxd4 5. Nf3 Nc6",
    "1. e4 c5 2. c3 Nf6 3. e5 Nd5 4. d4 cxd4 5. Nf3 e6",
    "1. e4 c5 2. c3 Nf6 3. e5 Nd5 4. d4 cxd4 5. cxd4 d6",
    "1. e4 c5 2. c3 Nf6 3. e5 Nd5 4. d4 cxd4 5. cxd4 e6",
    "1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. d4 Nf6 5. Nf3 e6",
    "1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. d4 Nf6 5. Nf3 Bg4",
    "1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. d4 Nc6",
    "1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. d4 e6",

    // Nimzo
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5 5. Nf3 cxd4 6. Nxd4 O-O 7. e3",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5 5. Nf3 d5 6. e3",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5 5. Nf3 d5 6. a3 Bxc3+ 7. Qxc3",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5 5. Nf3 d5 6. Bg5",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5 5. dxc5 O-O 6. a3 Bxc5 7. Nf3 Nc6 8. Bg5 Nd4 9. Nxd4",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5 5. dxc5 O-O 6. a3 Bxc5 7. Nf3 Nc6 8. e3 d5 9. b4",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5 5. dxc5 O-O 6. a3 Bxc5 7. Bf4",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5 5. dxc5 O-O 6. Nf3 Na6 7. g3",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5 5. dxc5 O-O 6. Nf3 Na6 7. Bd2",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5 5. dxc5 O-O 6. Nf3 Na6 7. e3",

    // Scotch games
    // French
    // Caro cann
];
let book_games_just_moves = [
// ];
// let nothing = [
    "d4 d5 c4 dxc4 Nf3 a6 e3 Bg4 Bxc4 e6 h3 Bh5 Nc3 Nc6 O-O",
    "c4 e5 Nc3 Bb4 Nd5 a5 Nf3 d6 a3 c6 axb4 cxd5 cxd5 Nf6 d3 Nxd5 Bd2 Nc6 bxa5",
    "e4 e6 d4 d5 Nc3 Nf6 Bg5 dxe4 Nxe4 Nbd7 Nf3 Be7 Nxf6+ Bxf6 h4 c5 dxc5 O-O Qd2 Nxc5 O-O-O Qxd2+ Nxd2 Bd4 f3 f6 Nb3 Nxb3+ axb3 e5",
    "d4 d5 Nf3 Nf6 c4 e6 g3 Bb4+ Bd2 Be7 Bg2 O-O O-O c6 Qc2 Nbd7 Rd1 b6 Nc3 dxc4 Ne5 Nxe5 dxe5 Nd5 Ne4 Ba6 Nd6 b5 b3 Bxd6 exd6 Qxd6 e4 Nb4 Qc3 Nd3 Qa5 c5 bxc4 bxc4 e5 Qb6 Bxa8 Rxa8 Qxb6",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nf3 Be7 Bg5 Nbd7 a4 h6 Be3 Ng4 Bd2 Ngf6 Be3 Ng4 Bd2 O-O O-O b6 Bc4 Bb7 Qe2 Ngf6 Nh4 Nc5 f3 d5 exd5 Nxd5",
    "e4 e5 Nf3 Nc6 Bc4 Bc5 Nc3 Nf6 d3 d6 Na4 Bb6 a3 O-O O-O Kh8 Nxb6 axb6 Ng5 Qe7 f4 h6 Nf3 Bg4 h3 Bxf3 Qxf3 b5",
    "f4 c5 Nf3 Nc6 g3 g6 Bg2 Bg7 O-O e6 d3 Nge7 e4 d6 c3 O-O g4 f5 h3 c4 Na3 d5 e5 cxd3 Qxd3 a6 Be3 b5 b4 Bd7 Nc2 Nc8 Ncd4 Nb6 Nxc6 Bxc6 Nd4 Bd7 Nb3 fxg4 hxg4 Nc4 Bc5 Rf7 Nd2 g5 Nxc4 bxc4 Qd4 Qc7 Bd6 Qxd6 exd6 Bxd4+ cxd4 Rxf4 Rxf4 gxf4 Kf2 Kg7 Kf3 Kg6 Kxf4 Rf8+ Kg3 Rb8 Rb1 Rb6 Kf4 Rxd6",
    "d4 e6 e4 d5 Nd2 c5 exd5 Qxd5 Ngf3 cxd4 Bc4 Qd8 O-O a6 Re1 Be7 Nb3 Nc6 Nbxd4 Nxd4 Nxd4 Nf6 b3 b5 Qf3 Rb8 Nc6 Bb7 Nxd8 Bxf3 gxf3 Rxd8 Bd3 Bb4",
    "e4 c5 Nf3 Nc6 d3 g6 g3 Bg7 Bg2 e5 O-O Nge7 c3 O-O a3 d6 Nbd2 Be6 b4 a6 Ng5 Bd7 Rb1 h6 Ngf3 Be6 Qc2 b5 bxc5 dxc5 Rd1 Rc8 Nb3 Na5 Nfd2 Nb7 Nf1 Qc7 Ne3 c4 dxc4 bxc4 Nd2 Rfd8 Bf1 Nd6 Qa4 Qa7 Ndxc4 Nxe4 Nb6 Nxc3 Nxc8 Rxc8 Qxa6",
    "d4 c5 d5 d6 g3 Nf6 Bg2 g6 Nf3 Bg7 O-O O-O c4 Na6 a3 Nc7 Nc3 Rb8 e4 a6 Re1 b5 e5 Ng4 exd6 exd6 h3 Ne5 Nxe5 Bxe5 Rxe5 dxe5 Ne4 Ne6 Bh6 Ng7 b3 bxc4 bxc4 f5 Ng5 Qd6 Qe2 e4 Re1 Qf6 Qd2 Rb2",
    "d4 Nf6 Nf3 d6 Nc3 g6 Bf4 Nh5 Bg5 h6 Bh4 g5 Bg3 Bg7 e4 Nc6 d5 Nxg3 hxg3 Ne5 Nd4 c5 Nf5 Bxf5 exf5 Qb6 Bb5+ Nd7 O-O O-O-O a4 Qa5 Qh5",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 d3 b5 Bb3 Be7 Nc3 d6 a3 Na5 Ba2",
    "d4 e6 c4 b6 e4 Bb7 Bd3 Bb4+ Bd2 Bxd2+ Nxd2 f5 Qh5+ g6 Qe2 Nc6 Ngf3 Qf6 e5 Qg7 O-O Nge7 Qe3 O-O Nb1 Nb4 Nc3 Nxd3 Qxd3 g5 Rfe1 g4 Nh4 Qh6 g3 Ng6 Nxg6 hxg6 d5 Rf7 Re2 Rh7 f4 gxf3 Qxf3 c6 dxe6 dxe6 Rd1 c5 Qf2 Qg7 Rd6 Re8 Qe1 Ba8 Qf2 Qb7 Kf1 Qh1+ Qg1 Qf3+ Ke1 g5 Red2 Qg4 Rd8 Re7 Qe3 Kf8 Nb5 Bc6 Rxe8+ Kxe8 Nd6+ Kf8 b3 Kg7 Nc8 Rc7 Rd8 Qe4 Qxe4 Bxe4 Nd6 Bc6 Rc8 Rxc8 Nxc8 a6 Nxb6 Kg6 Kf2 Kh5 Nc8 Kg4 a3 a5 Na7 Be4 Nb5 f4 Nd6 Bc2 Nb7 Bxb3 Nxa5 Ba2 Nb7 Kf5 Nxc5",
    "e4 c5 Nf3 d6 Bb5+ Nd7 a4 Nf6 Nc3 a6 Bc4 b6 d4 Bb7 d5 g6 O-O Bg7 Re1 O-O h3 Ne8 Bf4 Ne5 Nxe5 dxe5 Bh2 Nd6 Bf1 Qd7 Qe2 Rad8 Rad1 Kh8",
    "c4 e6 Nf3 d5 e3 Nf6 Nc3 Be7 b3 O-O Bb2 dxc4 Bxc4 a6 d4 b5 Bd3 Bb7 O-O Nbd7 Qe2 c5 Rfd1",
    "e4 c5 Nf3 Nc6 Bb5 g6 Bxc6 dxc6 d3 Bg7 h3 e5 O-O Ne7 Be3 b6 Nbd2 f6 a3 Qc7 b4 f5 Nc4 f4 Bc1 b5 Na5 Bf6 Bb2 h5 c4 g5 Nh2 g4 hxg4 hxg4 Nxg4 Bxg4 Qxg4 Kf7 cxb5 Rag8 Qf3 Ng6 d4 Nh4 Qb3+ Kf8 Rfd1 Qg7 Kf1 Qxg2+ Ke2 Qxe4+ Kd2 Rg2 dxe5 Bg5 Qd3 Rxf2+ Kc1 Qxd3 Rxd3 Ng6 Kb1 Rh1+ Ka2 Rhh2 Rb1 cxb5 bxc5 Nxe5 Rd5 Bf6 Kb3 Rh3+ Kb4 Nd3+ Rxd3 Rxd3 Bxf6 Kf7 Ba1 Rc2 Rf1 f3 Nc6 Ke8 Nxa7 Rd5 Nxb5 Rdxc5 Rxf3 R2c4+ Ka5 Kd7 Bc3 Rc8 Rd3+ Ke6 Rd6+ Kf5 Bb4 Ra8+",
    "e4 c5 Nf3 e6 d3 Nc6 g3 Nf6 Bg2 Be7 O-O",
    "d4 Nf6 Bf4 d5 e3 e6 Nd2 c5 c3 Bd6",
    "d4 Nf6 c4 e6 Nf3 d5 Nc3 c6 Bg5 h6",
    "Nf3 Nf6 g3 b6 Bg2 Bb7 O-O e6 d3 d5 Nbd2 Be7 e4 dxe4 Ng5 O-O Ndxe4 Nxe4 Nxe4 Qc8 Qf3 Nc6 Qh5 Nd4 c3 Nf5 Re1 Nd6 Ng5",
    "e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6 O-O Bd7 d4 Nf6 c3 g6 Re1 Bg7 h3 O-O Nbd2 b5 Bc2 Re8 Nf1 Na5 b3 Nh5 dxe5 dxe5 Bg5 Qc8 Qd2 Nb7 Bh6",
    "d4 Nf6 c4 e6 Nf3 Bb4+ Bd2 Qe7 g3 Bxd2+ Qxd2",
    "d4 Nf6 c4 e6 Nf3 d5 Nc3 c5 cxd5 Nxd5 e4 Nxc3 bxc3 cxd4 cxd4 Bb4+",
    "d4 d5 Bf4 e6 e3 Nf6 Nf3 Bd6 Bg3 c5 c3 Qc7 Nbd2 Nbd7 Bd3 O-O O-O e5 dxe5 Nxe5 Nxe5 Bxe5 e4 Bxg3 hxg3 Bg4 Qb1 c4 Bc2 Rae8 Re1 Re5 exd5 Rxe1+ Qxe1 Re8 Qc1 Qc5 Nf1 Qxd5 Qf4 Qb5 b3 Qa5 Qxc4 Rc8 Qd4 Qxc3 Qxc3 Rxc3",
    "Nf3 Nf6 c4 e6 Nc3 c5 e3 Be7 b3 O-O Bb2 b6 Be2 Bb7 O-O Nc6 Rc1 Rc8 d4 cxd4 Nxd4 Qc7 Bf3 Qb8 Qe2 Nxd4 exd4 Rfe8 h3 Bb4 Ne4 Nxe4 Bxe4 d5 Bf3 Ba6 Rc2 Be7 Qd3 Rc7 Be2 Bf6 Qe3 Rd8 Rfc1 dxc4 bxc4",
    "e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O c6 a4 Qc7 Be3 Nbd7 a5 e5 dxe5 Nxe5 Nxe5 dxe5 Bc4 Nh5 Bc5 Rd8 Qf3 Nf4 Rfd1 Rxd1+ Nxd1",
    "c4 e6 Nc3 d5 d4 Nf6 cxd5 exd5 Bg5 Be7 e3 c6 Bd3 Nbd7 h3 Nf8 Bf4 Ne6 Be5 Nd7 Bh2 b5 Nf3 O-O O-O b4 Na4 c5 dxc5 Ndxc5 Nxc5 Nxc5 Be2 Bb7 Be5 Rc8",
    "e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5",
    "e4 e6 d4 d5 Nc3 Nf6 Bg5 dxe4 Nxe4 Nbd7 Nf3 h6 Nxf6+ Nxf6 Bh4 Be7 Bd3 c5 Qe2 Qa5+ c3 cxd4 Nxd4 O-O O-O Re8 Rfe1 a6 Bc2 Qh5 Nf5 Qxe2 Nxe7+ Rxe7 Rxe2 Bd7 Rd1 g5 Bg3 Bc6 Red2 e5 f3 e4 Rd8+ Rxd8 Rxd8+ Kg7 fxe4 Nxe4 Bxe4 Rxe4 Kf2 h5 Bc7 h4 g3 h3 Rd4 Re7 Bd8 Re5 g4 f6 Bc7 Re7 Bd8 Re6",
    "e4 e5 Bc4 Nf6 Nc3 Nc6 d3 Na5 Nge2 c6 a4 Nxc4 dxc4 Be7",
    "Nf3 Nf6 g3 d5 Bg2 c6 O-O Bf5 c4 e6 cxd5 exd5 d3 Be7 Qb3 Qb6 Qc2 O-O Nc3 Nbd7 e4 dxe4 dxe4 Bg6 Nh4 Ne5 Be3 Qa6 Rad1 Rad8 Nxg6 hxg6 Bd4 Nfd7 f4 Nc4 Qe2 Nc5 f5 Nxb2 Qxb2 Nd3 Rxd3 Qxd3 Be5 gxf5 Rxf5 Bc5+ Kh1 Bd4 Bxd4 Rxd4 Rf1 Qd2 Qa1 Rc4 Rf3 Rd8 Bf1 Rc5 a4 Rh5 h4 Rh6 Ne2 Re6 Qb1 b6 Nf4 Re7 Bd3 Qc3 Qf1 Qe5 Nh3 Rd6 Kh2 a6 Bxa6 Qxe4 Ng5 Qc2+ Kh3 Rd1 Qc4 Qxc4 Bxc4 Rdd7 Rb3 Rb7 Bf1 b5 axb5 cxb5 Bxb5 f6 Nf3 Kh8 h5 Rec7 Nd4 Rc5 Be8 Rxb3 Nxb3 Rc4 Bf7 Rb4 Nc5 Rd4 Bg6 Rc4 Ne4 Ra4 Kg4 Ra5 Kf4 Kg8 Nd6 Kf8 Nf5 Re5 Nd4 Ra5 Ne6+ Kg8 Kg4 Ra4+ Nf4 Ra5 Be4 Rg5+ Kf3 Re5 Bd5+ Kh7 Bc4 Ra5 Bd5 Ra3+ Kg4 Re3 Be6 Re5 Bf7 Re3 Ne6 Ra3 Bg6+ Kg8 Kf4 Ra5 g4 Ra4+ Be4 Ra5 Bf5 Ra4+ Ke3 Kf7 Nc5 Rb4 Kd3 Rf4 Ne4 Rf1 Bg6+ Ke7 Ke2 Ra1 Bf5 Ra3 Kd2 Ra5 Kd3 Ra1",
    "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 h3 O-O Be3 Na6 Nf3 c5 d5 e6 Bd3 exd5 exd5 Nb4 Bb1 b5 a3 Qa5 O-O bxc4 Bf4 Rd8 Re1 Nd3 Bxd3 cxd3 Qxd3 Qb6 Qd2 Bf5 g4 Bc8 Bg5 Bb7 Re7 Rf8 Rae1",
    "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 d6 Bg5 e6 Qd2 a6 O-O-O Bd7 f3 Nxd4 Qxd4 Bc6 h4 h6 Be3 Qc7 g4 d5 exd5 Nxd5 Nxd5 Bxd5 Be2 Rc8 Rd2 Qa5 a3 Bc5 Qd3 Bb4 Rdd1 Rc3 bxc3 Bxc3 Rdg1 Ke7 Kd1 Rd8 Bb6 Qxb6 Qxc3 Bxf3+ Kc1 Bxe2 g5 Qd4 Qxd4 Rxd4 h5 Rd5 Rh2 Bb5 gxh6 gxh6 Rg8 Rf5 Rh8 Kf6 Kd2 Kg7 Rd8 Rg5 Rh3 e5 Rh2 Bc6 Rc8 Rg3 Rf2 e4 Rf4 Rxa3 Rc7",
    "e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6 Nc3 d6 Na4 Bb6 Nxb6 axb6 Bg5 h6 Bh4 O-O O-O Bg4 c3 g5 Bg3 Qd7 Bb3 Kg7 Re1 Nh5 h3 Bxf3 Qxf3 Nxg3 Qxg3 Ne7 d4 Ng6 Rad1",
    "c4 e6 d4 Nf6 Nc3 Bb4 e3 O-O Bd3 d5 cxd5 exd5 Ne2 Re8 O-O Bd6 Bd2 a6 Rc1 Nbd7 Nf4 c6 h3 Nf8 Nh5 Ne4 Nxe4 dxe4 Bc4 g6 Ng3 Be6 Nxe4 Bxc4 Nxd6 Bxf1 Nxe8 Bxg2 Kxg2 Qxe8 Qg4 Rd8 Rc5 Nd7 Ra5 Nf6 Qh4 Qe4+ Qxe4 Nxe4 Bb4 f5 Re5 Rd7 Re8+ Kf7 Rb8 Nf6 Kf3 g5 Ke2 h5 f3 Kg6 Kd3 g4 hxg4 fxg4 fxg4 hxg4 Be1 Rh7 e4 Rh3+ Ke2 Rh2+ Ke3 Rh1 Ke2 Nxe4 Rxb7 g3 Bxg3 Nxg3+ Kd3 Rd1+ Kc2 Rxd4 Rb6 Rd6 Rxa6 Kf6 b4 Ke5 a4 Ne4 Ra8 Rd2+ Kc1 Rd4 b5 Rc4+ Kd1 Kd4 bxc6 Ke3 Re8 Rxc6 a5 Ra6 Kc2 Rxa5",
    "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 a6 Bb3 Ba7 Nbd2 O-O Nf1 d5 Qe2 Be6 Ng3 h6 O-O dxe4",
    "Nf3 c5 c4 Nf6 Nc3 d5 cxd5 Nxd5 g3 Nc6 Bg2 e5 Nxe5 Nxc3 Nxc6 Nxd1 Nxd8 Nxf2 Nxf7 Nxh1 Nxh8 Nxg3 hxg3 Bd6 Kf2 Ke7 d3 Be6 Bg5+ Kd7 Bxb7 Rxh8 b3 Rb8 Be4 h6 Be3 Rf8+ Kg2 Bg4 Rc1 Bxe2 Bxc5 Bxc5 Rxc5 Rf7 b4 Bf1+ Kg1 Bh3 Ra5 Kd8 Kh2 Be6 Bd5",
    "Nf3 d5 e3 Nf6 c4 e6 Nc3 Be7 Qc2 O-O d4 c5 dxc5 Bxc5 a3 a5 cxd5 exd5 Nb5 Qb6 b3 Bg4 Nfd4 Nc6 Bb2 Rac8 Qd3 Ne5 Qb1 Rfe8 Bd3 Nxd3+ Qxd3 Bh5 O-O Bg6 Qe2 Ne4 Rac1 Nd6 Rfd1 Ne4 Nf3 Nxf2 Rxd5 Bd3 Rdxc5 Rxc5 Qxf2 Rxc1+ Bxc1 Qxb5 Nd4 Qg5 h3 Be4 Kh2 h5 Qg3 Qxg3+ Kxg3 g5 Kf2 Rd8 Bd2 b6 Bc3 Rd6 Be1 h4 Bc3 f5 g3 g4 gxh4 gxh3 Kg3 Rg6+ Kxh3",
    "Nf3 d5 d4 Nf6 c4 c6 Nc3 e6 Bg5 h6 Bxf6 Qxf6 e3 g6 Be2 Bg7 O-O Nd7 cxd5 exd5 b4 a6 a4 Qd6 b5 O-O bxc6 bxc6 a5 c5 Rc1 Bb7 dxc5 Nxc5 Na4 Ne6 Nd4 Nxd4 exd4 Rab8 Qd2 Rfe8 Nc5 Bc8 Bf3 Qf6 Rfd1 Rd8 Be2 h5 Na4 Kh7 Qc3 Re8 Bf3 Bg4 Nb6 Rbd8 Bxg4 hxg4 Qd3 Re4 Qxa6 Rxd4 Qb5 Rd6 Rxd4 Qxd4 Qc5 Qd2 Rf1 Re6 Qxd5 Bd4 g3 Rf6 Qg2 Qxa5 Nd5 Rxf2 Rxf2 Qe1+ Qf1 Bxf2+ Kg2 Qe4+ Kxf2 Qxd5 Qa1 Qf5+",
    "e4 e5 Nf3 Nc6 Bb5 Nf6 d3 Bc5 Bxc6 dxc6 Nbd2 Nd7 Nc4 f6 Qe2 Nf8 Be3 Bxe3 fxe3 Be6 O-O-O Bxc4 dxc4 Qe7 h4 h5 Nh2 Nd7 g4 O-O-O Nf1 Qf7 Ng3 hxg4 h5 f5 Nxf5 Nf6 Rxd8+ Rxd8 b3 b6 Ng3 Kb7 Rf1 Qe6 Qf2 Rh8 Qf5 Qe7 Kb2 a5 a4 Qe8 Rh1 Qe7 Qg6 Qe8 Qg5 Rh7 Rd1 c5 Rh1 Kb8 Rf1 Nxh5 Nxh5 Rxh5 Qxg7 Rh8 Qxg4 Rg8 Qh4",
    "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 Nc3 Nxc3 dxc3 Be7 Bf4 Nc6 Qd2 Be6 O-O-O Qd7 Ng5 Bxg5 Bxg5 f6 Be3 O-O-O b3 Rde8 f3 h5 h4 Bf5 Bf2 Re7 Be2 Rhe8 Rde1 Kb8 Bd1 Rxe1 Bxe1 Re7 Bf2 Ne5 Rg1 b6 c4 Re8 Bd4 Re7 Bc3 Re8 Kb2 Re7 Qf4 Ng6 Qd4 Be6 g4 hxg4 h5 Ne5 fxg4 Qe8 g5 fxg5 Rxg5 Qf8 Qg1 Nf3 Qf2 Rf7 Rg3 Ne5 Qe3 Bf5 c5 bxc5 Bxe5 dxe5 Qxe5 Qd8 Rc3 Qe7 Rxc5 Qxe5+ Rxe5",
    "e4 c6 d4 d5 e5 Bf5 Nf3",
    "d4 Nf6 Nf3 e6 c4 d5 Bg5 Be7",
    "d4 c5 d5 g6 e4 Bg7 Nf3 d6 Bb5+",
    "e4 c5 c3 g6 d4 cxd4 cxd4 d5 e5 Nc6 Nf3 Bg4 Bb5 Qb6 Bxc6+",
    "d4 d5 c4 e6 Nf3 Nf6 g3 Bb4+ Bd2 Be7 Bg2 O-O O-O Nbd7 Qc2 c6 Rd1 Ne4 Nc3 f5 e3 Qe8 Ne2 g5 Be1 Bd6 b4 f4 exf4 gxf4",
    "e4 e5 Nf3 Nc6 Bb5 Nf6 d3 Bc5 c3 O-O O-O d6 Nbd2 Bb6 Nc4 Ne7 Ba4 Ng6 Bc2 Re8 Re1 c6 Nxb6 axb6 d4 b5 h3 h6 a3 Qc7 Be3 Be6 Nd2 Rad8 Qf3 Qe7 a4 bxa4 Rxa4 Bc8 Qe2 Nh7 f3 Ng5 Kh1 h5 Qf2 Ne6 Bd3 h4 Bf1 Nef4 Raa1 Be6 Ra7 Ra8 Rea1 Rxa7 Rxa7",
    "d4 Nf6 c4 e6 Nc3 Bb4 f3",
    "e4 c6 d4 d5 f3 Qb6 a4 e6 c3 c5 exd5 exd5 Bb5+",
    "Nf3 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 g3 Bg7 Bg2 Nb6 d3 c6 O-O O-O Qc2 Na6 b3 Re8 Bb2 e5 a3 Qe7 Rac1 h6 b4 Nc7 Rb1 Bf5 Ne4 Rad8 Rfd1 Nb5 e3 Nd6 Nfd2",
    "d4 Nf6 Nf3 e6 g3 d5 Bg2 b5 O-O c5 c3 Nbd7 a4 b4 cxb4 cxb4 Ne5 Ba6 Bg5 Nxe5 dxe5 h6 Be3 Nd7 Bd4 Bc5 Re1 Bxd4 Qxd4 Qb6",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 h3 e6 g4 Be7 Bg2 Nfd7 O-O Nc6 f4 O-O Be3 Nxd4 Qxd4 b5 a4 bxa4 Qxa4 Rb8 Rfb1 Bb7 Qa5 Qc8 Rd1 Nc5 Rd2 Bc6 b4 Nd7 Rb1 Qb7 g5 Rfc8 Qa2 Nb6 Bf1 Bb5 Nxb5 axb5 Re2 Na4 Bd2 Nc3 Bxc3 Rxc3 Rb3 Rc4 Ree3 Rc7 h4 d5 c3 dxe4 Qg2 Qa7 Qxe4 g6 h5 Rbc8 hxg6 hxg6 Qd4 Qxd4 cxd4 Rd8 Re4 Rcd7 Kf2 Rxd4 Ke3 Rxe4+ Kxe4 Rb8 Bd3 Bd6 Rb1 Kg7 Ra1 Bxb4 Rb1 Bd6 Bxb5 Rh8 Rd1 Bb8 Rf1 Rh4 Ke3",
    "d4 Nf6 c4 c6 Nf3 d5 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O Nbd7 Qe2 Bg4 Rd1 Qa5 e4 Qh5 Rd3 e5 h3",
    "d4 d5 c4 c6 e3 Bf5 Nc3 e6 Nf3 Nd7 Bd3 Bxd3 Qxd3 Ngf6 O-O Be7 e4 O-O cxd5 exd5 exd5",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Na5 Bc2 c5 d4 Qc7 Nbd2 Re8 Nf1 Bb7 d5 Nc4 b3 Nb6 Ne3 g6 a4 Bc8",
    "d4 d5 c4 e6 Nf3 Nf6 g3 Bb4+ Bd2 Be7 Bg2 O-O O-O c6 Bf4 Nbd7 Qc2 b6 Rd1 Bb7 Nc3 dxc4 Nd2 Nd5 Nxc4 Nxf4 gxf4 Rc8 a3 Rc7 e3 Nf6 b4 Nd5 Rac1 Re8 Ne5 Bd6 Qa4 Qa8 Ne4 Be7 Rc2 Rec8 Rdc1 a5 bxa5 c5 Ng5 Bxg5 fxg5 f6",
    "e4 c5 Nf3 Nc6 Nc3 e6 d4 cxd4 Nxd4 Nf6 Ndb5 d6 Bf4 e5 Bg5 a6 Na3 b5 Nd5 Be7 Bxf6 Bxf6 c4 b4 Nc2 O-O Be2 a5 O-O Rb8 Qd3 Bg5 Rad1 Be6 b3 Kh8 Nde3 g6 Bg4 Qc8 Bxe6 fxe6 Qxd6 Rd8 Qc5 Rxd1 Nxd1 Qd7 Nb2 Be7 Qe3 Rd8 Qb6 Rb8 Qe3 Rd8 Ne1 Qa7 Qxa7 Nxa7 Nf3 Nc6 Rd1 Rxd1+ Nxd1 Kg7 Nb2 h5 Kf1 Kf6 h3 Nb8 Ke2 Nd7 Na4 Bd6 Kd3 Ke7 g4 hxg4 hxg4 Kd8 Nh4 g5 Nf3 Be7",
    "d4 d5 c4 e6 Nf3 Nf6 Nc3 Be7",
    "d4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7 Bg2 c6 O-O d5 Qc2 Nbd7 Bf4 O-O Rd1 Rc8 Nc3 Qe8 e4 dxc4 Bh3 h6 Nd2 b5 bxc4 bxc4 Bf1 Nb6 a4 Bb4 a5 Nbd7 Bxc4 Bb5 Qb3 Bxc3 Qxc3 Qe7",
    "Nf3 Nf6 c4 g6 Nc3 Bg7 e4 d6 d4 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7 f3 f5 g4 Nf6 Nd3 c6 Be3 Kh8 Kh1 Bd7 Rg1 Be8 Qd2 fxe4 fxe4 b5 b3 Rc8 g5 Nxe4 Nxe4 cxd5 cxd5 Nxd5 Rgc1 Bc6 Rxc6 Rxc6 Bg1 Qa8 Bf1",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3",
    "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7 c4 Nb4 Be2 O-O a3 Nc6 cxd5 Qxd5 Nc3",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 Ng4 Bc1 Nf6 Be3 Ng4 Bg5 h6 Bh4 g5 Bg3 Bg7 h3 Ne5 f3 Nbc6 Bf2",
    "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Be7 O-O Nc6 Nc3 Nxc3 bxc3 Bg4 h3 Bh5 Rb1 Rb8 g4 Bg6 Ne5 Bxd3 Nxd3 O-O Qf3 Na5 Bf4 Rc8 Rfe1 c6 Re2 Bg5",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e6 a4 Nc6 O-O Be7 Be3 Qc7 f4 O-O Kh1 Re8 Bf3 Na5 g4 Nd7 g5 Bf8 Bg2 b6 Qe1 Nc4 Bc1 Qc5 Qf2 Bb7 b3 Na5 Nde2 Qxf2 Rxf2 d5 Be3 Nc5 Rd1 Rad8 Ng3 Nc6 Rfd2 Nb4 exd5 exd5 Bf2 Bd6 Nce2 Bc7 a5 Ne4 Nxe4 dxe4 axb6 Rxd2 Rxd2 Bb8 c4 h6 Be3 hxg5 fxg5 Nd3 Nc3 Nf4 Kg1 f5 gxf6 gxf6 Bf1 Be5 Na4 Bc6",
    "Nf3 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 Qb3 Nb6 d4 Bg7 Bf4 Be6 Qa3 Nc6 e3 a5 Be2 Nb4 O-O c6 Ng5 Bd5 Rfc1 h6 Nge4 Nc4 Nxd5 Nxa3 Nc7+ Kf8 bxa3 Nd5 Nxd5 cxd5 Nc5 b6 Bc7 Qe8 Bxb6 Kg8 Rab1 e5 dxe5 Qxe5 Bf3 Kh7 Rd1 Qe7 Bxd5 Rab8 Na4 Qxa3 Bb3 Rhc8 Bxa5 Ra8 Nb6 Qxa5 Nxa8 Rxa8 Bxf7 Qf5 Bb3 Rf8 Rf1 h5 Rbd1 Be5 Rd5 Qe4 h3 Kh6 Rfd1 g5 R5d2 Bb8 Rc2 g4 hxg4 hxg4 g3 Qf3 Rd5 Rf6 Kh2 Bd6 Rcd2 Bb4 Bd1 Qe4 R5d4 Qb1 Rc2 Ba5 Kg2 Bb6 Rd3 Qb5 Rcd2 Qb4 Kg1 Ba5 Rc2 Qb5 Rd4 Bb6 Rdc4 Qb1 Rc1 Qxa2 R1c2 Qa5 Rc6 Rxc6 Rxc6+ Kg5 Re6 Bc7 Be2 Qa2 Re7 Bxg3 Rg7+ Kf6 Rxg4 Be5 Bf3 Qb1+ Kg2 Qh7",
    "e4 e5 Nf3 Nf6 d4 Nxe4 Bd3 d5 dxe5 Nc5",
    "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 Bg5 h6 Bxf6 Qxf6 e3 Nd7 Bd3 dxc4 Bxc4 g6 O-O Bg7 e4 e5 d5 Nb6 Bb3 Bg4 Rc1 O-O h3 Bxf3 Qxf3 Qxf3 gxf3 Rfd8 dxc6 bxc6 Nd1 Rac8 Rc5 Bf8 Rc2 h5 Ne3 Rd4 Rfc1 c5 Kf1 Rcd8 Ke2 Be7 Rg1 Kf8 Bc4 Rb8 Ra1 Rbd8",
    "Nf3 d5 d4 Nf6 c4 c6 Nc3 dxc4 a4 e6 e4 Bb4 e5 Nd5 Bd2 b5 axb5 Bxc3 bxc3 cxb5",
    "Nf3 Nf6 c4 b6 g3 c5 Bg2",
    "d4 Nf6 c4 e6 Nf3 b6 g3 Ba6",
    "d4 Nf6 c4 e6 Nf3 d5 Nc3 Bb4 cxd5 exd5 Qa4+ Nc6 Bg5 h6 Bxf6 Qxf6",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Na5 Bc2",
    "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6",
    "e4 c5 Nf3 e6 c3 d5 exd5 Qxd5 d4 Nf6 Na3 Nc6 Be3 cxd4 Nb5 Qd8 Nbxd4",
    "d4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7 Nc3 c6 e4 d5 Bd3 dxc4 bxc4 e5 Ne2",
    "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8 Nc3 h6 h3 Bd7 b3 Kc8 Bb2 b6 Rad1 c5 Rfe1 Ne7 Ne2 Ng6 h4 Bg4 Nh2 Bxe2 Rxe2 Nxh4 Re4 Be7 e6 fxe6 Rxe6 Bd6 Bxg7 Rg8 Rxh6 Nxg2 Kxg2 Rxg7+ Kf1 Kb7 Nf3 Rf8 Rd3 Rgf7 Ke2 c4 bxc4 Rf4 Rh4 Rxh4 Nxh4 Rf4 Nf3 Rxc4 c3 Be7 Kd1 Bc5 Kc2 Bxf2 Kb3 b5 Nd2 Rh4 c4 Kb6 cxb5 Kxb5 Nb1 c5 Na3+ Kc6 Nc4 Bd4 Rg3 Rh5 Ne3 Kd6 Kc4 Ke5 Nc2 Bf2 Ra3 Rh4+ Kb5 Rh7 Kc4 Rg7 Ra6 Bg1 Ra5 Rh7 Ra6 Rf7 Ra5 Ke4 Ra6 Rf2 Kc3 Rf7 Kc4 Ke5 Ra5 Rg7 Ra6 Rh7 Ra5 Ke4 Ra4 Kf3 Kc3 Re7 Ra6 Ke2 Rd6 Bf2 Rd2+ Kf3 Rd3+ Ke4 Kc4 Kf4 Ra3 Bg1 Ra6 Kf3 Rd6 Bf2 Kc3 Bh4 Rd5 Bf2 Kd3 Kf4 Rd6",
    "c4 e5 g3 Nf6 Bg2 d5 cxd5 Nxd5 Nc3 Nb6 Nf3 Nc6 O-O Be7 a3 O-O b4 Re8 d3 Bf8 Nd2 a5 b5 Nd4 e3 Nf5 Qc2 Nd6 a4 Bf5 Nb3 Qc8 Re1 Rd8 Ba3 Bxd3 Qxd3 Ndc4 Qe2 Bxa3 Nd5 Bd6 Nxb6 Nxb6 Red1 f5 g4 fxg4 Nd2 Qe6 Bxb7 Rab8 Bc6 Bb4 Ne4 h6 Kg2 Rxd1 Rxd1 Rf8 Ng3 Kh8 Qc2 Qc4 Be4 Qxc2 Bxc2 Rf7 Ne4 Rd7 Rc1 Ba3 Ra1 Be7 Bb3 Rd3 Rb1 g6 Kf1 Kg7 Ke2 Rd7 Be6 Rd8 Rc1 Nxa4 Rxc7 Kf8 Rc6 Rb8 Bb3 Nb6 Rxg6 Ke8 Rxh6",
    "d4 d5 Nf3 Nf6 c4 c6 Qb3 dxc4 Qxc4 Bg4 Nbd2 Nbd7 g3 e6 Bg2 Be7 O-O O-O Ne5 Bh5 Nxd7 Nxd7 Ne4 Qb6",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7 Nbd2 Bb7 Bc2 Re8 a4",
    "d4 d5 c4 e6 Nf3 dxc4 e3 c5 Bxc4",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O b5 Bb3 Bc5 c3 d6 a4 Bb7 d3 O-O Bg5 h6 Bh4 g5 Bg3 Ne7 Na3 b4 Nc4 bxc3 bxc3 Rb8 Bc2 Ng6 d4 exd4 cxd4 Ba7 e5 Nh5 exd6 Nxg3 fxg3 Bxf3 Rxf3 Rb4 Bxg6 Rxc4 Kh1 Rxd4 Qb3 Qxd6 Bxf7+",
    "e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6 Bd3 Nf6 O-O Qc7 Qe2 d6 c4 g6 Nc3 Bg7 Nf3 O-O Bf4 Nc6 Rac1 e5 Bg5 h6 Bd2 Bg4 Qe3 Bxf3 Qxf3 Nd4 Qd1 Qd7 Be3 Ng4",
    "d4 Nf6 c4 e6 Nf3 d5 Bg5 h6 Bxf6 Qxf6 Nbd2 Be7 a3 c5 e4 cxd4 cxd5 exd5 exd5 O-O Ne4 Qf4 Qxd4 Re8 Be2 Bxa3 Rxa3 Rxe4 Qd2 Nd7 Qxf4 Rxf4 O-O Rb4 b3 Nf6 Rd1 Bf5 Nd4 Be4 d6 a6 Bf3 Rd8 Bxe4 Nxe4 Nf5 Rb5 f3 Nc3 Ne7+ Kf8 Rd3 Ne2+ Kf2 Nc1 Rd1 Nxb3 g4 g6 h4 Nc5 Rc3 Ne6 Re3 Kg7 Kg3 Rb6",
    "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 Nc3 Nxc3 dxc3 Be7 Be3 Nc6 Qd5 Bf6 O-O-O Ne7 Qh5 O-O Ng5 Bf5 Bd3 Bxg5 Bxg5 Bxd3 Rxd3 f6 Bd2 Qe8 Qh3 Qf7 b3 Rae8 Re1 Ng6 Rde3 Re5 g3 d5 f4 Rxe3 Rxe3 Re8 Qf5 c6",
    "d4 d5 Nf3 Nf6 c4 c6 e3 Bf5 Nc3 e6 Nh4 Bg6 Be2 Nbd7 O-O dxc4 Nxg6 hxg6 Bxc4 Bd6 g3 Qe7 f4 c5 d5 Nb6 Bb5+ Kf8 dxe6",
    "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O h3 Bb7 d3 d6 a3",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 Na5 Bc2 c5 d4 Qc7 Nbd2 O-O b3 Re8 h3 Bf8 d5 g6 Nf1 Bg7 Ng3 Nb7 Bg5",
    "d4 Nf6 c4 e6 Nf3 b6 g3 Ba6 Qc2 Bb7 Bg2 c5 d5 exd5 cxd5 Nxd5 O-O Be7 Rd1 Nc6 Qf5 Nf6 e4 g6 Qf4 O-O e5 Nh5 Qc4 d5 exd6 Bxd6 Nc3 Na5 Qd3 Bc7 Qc2 Qe7 Re1 Qd7 Bg5 f6 Bh6 Rfd8 Rad1 Qf7 b4 cxb4 Nb5 Rxd1 Rxd1 Rd8 Rxd8+ Bxd8 Nd6 Qd7 Nxb7 Nxb7",
    "d4 d5 c4 c6 Nc3 Nf6 e3 a6 Nf3 e6 b3 Bb4 Bd2 O-O Bd3 Bd6",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 d3 d6 c3 g6 O-O Bg7 Re1 O-O Nbd2 Re8 Nf1 h6 Ng3 b5 Bc2 d5 Qe2 Be6 h3 Nd7 Be3 d4 Bd2",
    "Nf3 d5 d4 Nf6 c4 e6 Nc3 Bb4 Qa4+ Nc6 Ne5 Bd7 Nxd7 Qxd7 e3 O-O a3 Bxc3+ bxc3 e5 Be2 Rfe8 Bb2 dxc4 Qxc4",
    "e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 f6 O-O fxe5 dxe5 Bc5 Nbd2 Ne7 Nb3 Bb6 Nfd4 O-O c4 Nd7 g4 Bxd4 Nxd4 c5 Nb5 Bg6 f4 Nb6 b3 Be8 Nd6 Bc6 Be3 d4 Bd2 Nbc8 Nxc8 Qxc8",
    "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O h3 e5 d5 Nh5 g3 Qe7 Nh2 Na6 Be3 Nc5 h4 a5 Be2 Nf6 Qc2 c6 g4 Na6 g5 Ne8 h5 Nb4 Qd2 cxd5 cxd5 Bd7 O-O-O f5 Kb1 b5 hxg6 hxg6 f3 Nc7 Rc1 Nba6 Bd3 b4 Ne2 Nb5 Rc6 Rfb8 Rhc1 f4 Bf2 Bf8 Ng4",
    "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O Qf6 d4 exd4 Bg5 Qd6 Nxd4 Bd7 Nc3 Be7 Bxe7",
    "Nf3 Nf6 g3 d5 Bg2 c6 c4 Bf5 O-O e6 cxd5 exd5 d3 Bc5 Qb3 Bb6 Nc3 O-O Na4 Re8 Bf4 Nbd7 Nxb6 axb6 Qc2 b5 Nd4 Bg6 b4 Qe7 a3 Nf8 Bc1 Ne6 Nf3 Nd7 Bb2 Nb6 Rae1 Nc4 Bc1 Nd6 Bb2 Nc4 Bc1 Nd6 Qb3 Bh5 Bb2 Rad8 h3 Bxf3 Bxf3 Qg5 e3 Qg6 Bg2 Re7 h4 Rde8 Qd1 Nf8 Bh3 h5 Qf3 Nd7 Qf4 Ne5 Rd1 Ng4 Rfe1 Qf5 Qxf5 Nxf5 Ra1 Ra8 Red1 Nd6 Kg2 Ree8 Kf3 Ne5+ Ke2 Ng4 Rd2 f6 Kd1 Kf7 Kc2 Ne5 Kb3 Ra4 Bf1 Raa8 Be2 Ng4 Bf3 Ra6 Re1 Kg6 Bd1 Kf7",
    "d4 Nf6 c4 e6 Nf3 Bb4+ Nbd2 O-O a3 Be7 e4 d5 e5 Nfd7 Bd3 c5 O-O Nc6 Re1 a5 Bc2 Qc7 dxc5 Nxc5 Nb3 Nxb3 Qd3 g6 Bxb3 Rd8 Bf4 a4",
    "d4 Nf6 c4 e6 Nf3 d5 Nc3 Bb4 cxd5 exd5 Bf4 O-O Rc1 Bf5 a3 Ba5 e3 c6 Be2 Nbd7 O-O Re8 b4 Bc7 Bxc7 Qxc7 b5 Qd6 Qb3 c5 dxc5 Nxc5 Qb4 Rac8 Rfd1 Be6 h3 Red8 Nd4 Qf8 b6 axb6 Qxb6 Nfd7 Qb2 Nf6 Bf3 Rd7 Qb4 Qd8 Nce2 Rdc7 Nf4 Bd7 Qa5 Ra8 Qb6 Ra6 Qb4 Ra4 Qb6 Ra6 Qb4 Ra4 Qb2 Ne6 Nxd5 Rxc1",
    "Nf3 Nf6 d4 d5 c4 e6 Nc3 Be7 Bg5 h6 Bf4 O-O e3 Nbd7 g4 dxc4 Bxc4 Nb6 Bb3 Nfd5 Bg3 c5 Ne5 cxd4 Qxd4 Nxc3 bxc3 Nd5 O-O Qa5 Rac1 Rd8 Rfd1 Bd7 Bxd5 exd5 Qxd5 Qxd5 Rxd5 Be6 Rb5 Ba3 Ra1 b6 c4 f6 Rb3 Bf8 Nc6 Rdc8 Nd4 Bxc4 Rbb1",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O a4 Bb7 d3 d6 Nbd2",
    "d4 Nf6 c4 g6 Nc3 d5 Nf3 Bg7 Qb3 dxc4 Qxc4 O-O e4 a6 Be2 b5 Qb3 c5 dxc5 Bb7 e5 Nfd7 Be3 e6 O-O Qc7 Rad1",
    "d4 Nf6 c4 g6 Nc3 d5 Bg5 Bg7 Bxf6 Bxf6 cxd5 c5 dxc5 Nd7 e3 O-O Bc4 Nxc5 Nge2 Qa5 Qd2 b5 Nxb5 Qxd2+ Kxd2 Rb8 Rhb1 Bf5 Nbd4 Bxb1 Rxb1 Ne4+ Ke1 Rb6 b4 Rc8 Nc6 e6 Rc1 Rbxc6 dxc6 Rxc6 b5 Rc5 f3 Nd6 Bd3 Rxc1+ Nxc1 Kf8 Kd2 Ke7 Nb3 Kd7 a4 Kc7 Kc2 Nb7 Be4 Nd6 Bd3 Nb7 Be4 Nd6 Kd3 Kb6 f4 h5 g3 Bg7 Ba8 Bf6 Bh1 Bh8 Bf3 Bg7 Bg2 Bh8 Bh1 Bg7 Bc6 a6 Nd2 axb5 axb5 Nxb5 Be8 Nd6 Nc4+ Kc7 Nxd6 Kxd6 Bxf7 h4 Bxg6 hxg3 hxg3 Bb2 Ke4 Ke7 Bh5 Kf6 g4 Ke7",
    "d4 Nf6 Nc3 d5 Bf4 Bf5 f3 e6 g4 Bg6 h4 h5 g5 Nfd7 e3 a6 Bd3 Bxd3 cxd3 Nc6 g6 fxg6 Bg5 Be7 f4 Nf6 Qb3 Qd7 Nf3 Ng4 Ke2 Bf6 Rac1 b6 Rc2 Ne7 Rhc1 O-O Qa4 Qd8 Nd1 Ra7 Nf2 Nh6 Rg1 Nf7 Qa3 Kh7 Nh3 Nd6 Ne5 Ndf5 b4 Qd6 Qc3 c6 Nf3 a5 bxa5 Rxa5 Qd2 Ra3 Rgc1 Rfa8 Nf2 c5 dxc5",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 h3 e5",
    "Nf3 Nf6 c4 c5 Nc3 Nc6 g3 d5 d4 e6 cxd5 Nxd5 Bg2 cxd4 Nxd4 Nxc3 bxc3 Nxd4 Qxd4 Qxd4 cxd4 Bd6 O-O Rb8 e4 b6 Bb2 Bb7 Rac1 f6 Rfd1 Ke7 f4 Rhc8 e5 fxe5 fxe5 Bb4 Rxc8 Bxc8 Be4 g6 Rc1 Kd8 Kf2 Bb7 Kf3 Bd5 Bxd5 exd5 Ke3 Rc8 a4 Rxc1 Bxc1 Kd7 Bd2 Be7 Kd3 h5 a5 bxa5 Bxa5 g5 h3 g4 hxg4 hxg4 Ke3 Bg5+ Kd3 Kc6 Bd2",
    "d4 Nf6 c4 e6 Nf3 d5 Nc3 c6 e3 Nbd7 Qc2 Bd6 Bd3 O-O O-O dxc4 Bxc4 a6 Rd1 b5 Bd3 Qc7 Bd2 c5 Ne4 c4 Nxd6 Qxd6 Be2 Bb7 b3 Rfc8 Qb2",
    "e4 e6 d4 d5 Nc3 dxe4 Nxe4 Bd7 Nf3 Bc6 Bd3 Nd7 Qe2 Be7 Neg5 Bxg5 Nxg5 h6 Nf3 Qf6 Ne5 Nxe5 Qxe5 O-O-O Be3 Qe7 O-O-O Nf6 f3 g5 c4 b6 Bd2 Nh5 d5 f6 Qe2",
    "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e6 f3 b5 g4 h6 Qd2 b4 Na4 Nbd7",
    "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5 Nd5",
    "d4 Nf6 c4 e6 Nc3 Bb4 Qc2 d5 a3 Bxc3+ Qxc3",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5 exd5 Nxd5 Nxe5 Nxe5 Rxe5 c6 d4 Bd6 Re1 Qh4 g3 Qh3 Be3 Bg4 Qd3 Rae8 Nd2 Qh5 a4 Re6 axb5 axb5 Qf1 Rfe8 Bxd5 Qxd5 h3 Bf5 Qg2 Qxg2+ Kxg2 R6e7 b3 f6 Ra2 Be6 c4 Bb4 Rc1 Bf5 g4 Bd3 Nf1 Be4+",
    "Nf3 d5 d4 e6 c4 Nf6 Nc3 Be7 Bg5 h6 Bxf6 Bxf6 Qc2 O-O O-O-O c5 dxc5 d4 Nxd4 Bxd4 Qe4 Nc6 e3 f5",
    "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 Nc3 Nxc3 dxc3 Be7 Be3 Nc6 Qd2 Be6 O-O-O a6 Ng5 Bxg5 Bxg5 Qd7 b3 f6 Be3 O-O-O h3 Qf7 Be2 h5 Rhe1 Rhe8 f3 Qg6 Bf1 Bf5 Kb2 Re5 Bf4",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O h3 Bb7 d3 d6 a3 Na5 Ba2 c5 Nbd2 Nc6 Nf1 Bc8 c3 Be6",
    "d4 d5 c4 c6 Nf3 Nf6 e3 Bf5 Nc3 e6 Nh4 Bg6",
    "Nf3 c5 c4 Nf6 g3 b6 Bg2 Bb7 O-O e6 Nc3 Be7 d4 cxd4 Qxd4 Nc6 Qf4 Qb8 Qxb8+ Rxb8 Bf4 Rc8 Nb5 Ne4 Rfd1 a6 Nd6+ Nxd6 Bxd6 Bxd6 Rxd6 Ke7 Rad1 Rc7 b3 f6",
    "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 e5 Nb5 a6 Nd6+ Bxd6 Qxd6 Qf6 Qd2 Nge7 Nc3 d6 b3 O-O Bb2 Be6 Nd5 Qh4 Nxe7+ Nxe7 Bd3 d5 Qe3 d4 Qg3 Qxg3 hxg3 Nc6 c3 Rfd8 Ke2 a5 cxd4",
    "d4 Nf6 c4 e6 Nf3 b6 g3 Bb4+ Bd2 Be7 Nc3 Bb7 Bg2 c6 Bf4 d5 cxd5 cxd5 Nb5 Na6 O-O O-O Rc1 Ne4 h4 Nd6 a4 Nc4 Ne5 Na5 Bh3 Qe8 h5 Nc6 h6 g5 e4 dxe4",
    "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8 Nc3 Ne7 h3 Ng6 Bg5+ Ke8 Rad1 Bd7 Nd4 h6 Be3 h5 f4 h4 f5 Nxe5 f6 Rh5 Ne4 g6 Bf4 c5 Nf3 Nxf3+",
    "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 Be3 Ng4 Bg5 f6 Bh4 g5 Bg3 Nh6 d5 Nd7 Nd2 f5 exf5 Nf6 Nde4 Nxe4 Nxe4 Bxf5 Bd3 g4 O-O Qe8 c5 Qg6 Re1 Nf7 Bh4 Rae8 Rc1 dxc5 Rxc5 Nd6 Qa4 Bxe4 Bxe4 Qh6 Bg3 Qd2 Rcc1 Re7 h4 Qxb2 Qd1 Qxa2 h5 Nxe4 Rxe4 Qa6 Qb3 Kh8 Rce1 Qb6 Rb4",
    "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O",
    "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 c5 Nf3 d5 O-O dxc4 Bxc4 Nbd7 a3 cxd4 axb4 dxc3 bxc3 Qc7 Be2 Nd5 Bd3 Qxc3 Ra3 Qf6 Qc2 h6 b5 Nb4 Bh7+ Kh8 Qb1 a5 Be4 Nc5 Bd2 Bd7 Bxb4 axb4 Qxb4 Rxa3 Qxc5 Rfa8 Ne5 b6 Qc7 Bxb5 Bxa8 Rxa8 Rd1 Ba4 Rd4 Be8 g3 Kh7 Kg2 Ra5 Nc4 Ra2 Rf4 Qc3 Qxb6 Ra1 Qb7 Qc1 Kh3 f6 Rg4 Bg6 Rxg6 Kxg6 Qe4+ Kf7 Nd6+ Ke7 Nf5+ Kd7 Nxg7 Qf1+ Kh4 Qxf2 Qxe6+ Kc7 Qc4+ Kb7 Qe4+ Kb8 Qf4+ Qxf4+ exf4 Ra2 h3 Kc8 Kh5 Ra3 Nf5 Kd7 Kxh6 Ke6 Kg6 Ra5 Ng7+ Ke7 h4 Ra6 Nh5 Ra8 Ng7 Ra6 g4 f5+ Kxf5 Kf7 Nh5 Ra5+ Ke4 Ra3 g5 Rh3 Kf5 Rxh4 g6+ Kg8 Kg5 Rh1 Nf6+ Kf8 Nh5 Rg1+ Kh6 Rh1 f5 Kg8 Kg5 Rg1+ Kf6 Rg4 Ng7 Ra4 Ne6 Ra5 Nc7 Kf8 Ke6 Ra7 Nb5 Re7+",
    "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 Nc3 Nxc3 dxc3 Be7 Bf4 O-O Qd2 Nd7 O-O-O Nc5 Be3 Re8 Bc4 Be6",
    "d4 d5 c4 c6 Nc3 Nf6 Nf3 e6",
    "d4 d5 c4 c6 Nc3 Nf6 e3 a6 Nf3 e6 b3 Bb4",
    "d4 d5 c4 c6 Nc3 Nf6 Nf3 e6 Bg5 h6 Bh4 dxc4 e4 g5 Bg3",
    "d4 Nf6 c4 e6 Nc3 Bb4 Nf3 c5 g3 Ne4 Qd3 Qa5 Qxe4 Bxc3+ Bd2",
    "d4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7 Bg2 c6 Bc3 d5 Ne5 Nfd7 Nxd7 Nxd7 Nd2 O-O O-O Rc8 e4 c5 exd5 exd5 dxc5 dxc4 cxb6 Nxb6 Re1 Bf6 Bxf6 Qxf6 Ne4 Qg6 Qd6 Qxd6 Nxd6 Rcd8 Nf5 g6 Ne3 Rfe8 Bf1 Re5 bxc4 Rc5 Rec1 Rdc8 Rc2 Kg7 Rac1 R8c7 Rc3 Bc8 Nc2 Na4 Ra3 Bd7 Nd4 Re5 Rd1",
    "d4 Nf6 c4 e6 Nc3 Bb4 Nf3 c5 g3 cxd4 Nxd4 O-O Bg2 d5 cxd5 Nxd5 Qb3 Qb6 Bxd5 exd5 Be3 Bh3 Rc1 Nc6 Nxc6 Qxc6 f3 Qc4 Kf2 Be6 Qxc4 dxc4 Rhd1 Bxc3 bxc3 b6 Rd4 Rfd8 g4 Rd5 g5 Rad8 h4 Kf8 Rb1 Ke7 Rb2 R8d6 Rxd5 Rxd5 Bd4 f6 e4 Ra5 f4 Bd7 Ke3 Rb5",
    "d4 Nf6 Nf3 e6 c4 b6 g3 Ba6 Nbd2 d5 cxd5 exd5 Ne5 Be7 Qa4+ c6 Bg2 Bb7 O-O O-O Rd1 Re8 Ndf3 h6 Bf4 Bf8 Rac1 c5 h4 Na6 Bh3 Bd6 e3",
    "d4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6 Bg5 Bb7 Nf3 d6 Nd2 Nbd7 f3 d5 cxd5 exd5 e3 Re8 Be2 Rc8 O-O Qe7 Bb5 c6 Ba4 h6 Bxf6 Nxf6 Rfe1 b5 Bc2 c5 Bf5 Rc7 dxc5 Rxc5 Qd4 a6",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O a4 Bb7",
    "d4 Nf6 c4 g6 g3 Bg7 Bg2 O-O Nc3 d6 Nf3 c5 O-O Nc6 d5 Na5 Nd2 e5 b3 Ng4 h3 Nh6 Nde4 f6 Nxd6 Qxd6 Ne4 Qd8 Nxc5 f5 d6 e4 d7 Nf7 Rb1 Qe7 dxc8=Q",
    "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Bd6",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7 Nbd2",
    "d4 Nf6 Nf3 e6 g3 d5 Bg2 b5 Nbd2 Bb7 Nb3 a5 Bd2 Nc6 Nc1 Bd6 Nd3 O-O O-O Ne4 Be3 b4 Re1 Ba6",
    "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Qc2 Bd6 b3 O-O Be2 b6 O-O Bb7 Bb2 Re8 Rad1 Qe7 Rfe1 Rac8 e4 Nxe4 Nxe4 dxe4 Qxe4",
    "e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6 Bd3 Bc5 Nb3 Ba7 Qe2 d6 Be3 Nc6 f4 Nge7 O-O O-O c3 b5 N1d2 Bxe3+ Qxe3 Rb8 Kh1 Qb6 Qe2 a5 a3 Bd7 Rf3 Ng6 g3 Rfd8 Rd1 Nce7 h4 h6 Kh2 Be8 Rg1 Nc6 h5 Nf8 g4 e5 g5 hxg5 fxg5 Rb7 Qf1 Ne6 h6 g6 Nc1 Qc7 Qf2 Qe7 Qh4 b4",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nf3 Qc7 a4 Be7 a5 O-O Be2 Be6 O-O Rc8 Nd5 Nxd5 exd5 Bg4 c4 Nd7 Nd2 Bxe2 Qxe2 f5 f3 Nf6 b4 Qd7 Rfd1 Qe8 Qd3 Qh5 c5 Rd8 Nc4 Rac8 Rac1 e4 fxe4 fxe4 Qb3 Ng4 h3 Nxe3 Nxe3 Bg5 c6 Rf8 Re1 Qh4 Qa2 Bf4 Qe2 Qg3 Nf1 Qd3 Qxd3 exd3 Rc4 bxc6 dxc6 d5",
    "e4 c5 Nf3 d6 c3 Nf6 Be2 Bd7 d3 e6 Nbd2 Be7 O-O O-O a3 Bc6 Re1 Nbd7 Bf1 Ne5 Nxe5 dxe5 Nc4 Qc7 b4 Rfd8 Qb3 b5 Na5 Be8 f3 Nd7 Be3 Nb6 Rec1 Na4 Qc2 h6 Qf2 Bg5 Bxg5 hxg5 Rc2 Rac8 Rac1 Qe7 Qe1 Rc7 c4 Rdc8 cxb5 Bxb5 bxc5 Rxc5 Rxc5 Rxc5 Qb4 Bxd3 Rxc5 Qxc5+ Qxc5",
    "d4 Nf6 Nf3 e6 c4 b6 g3",
    "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 Bg5 h6 Bh4 dxc4 e4 g5 Bg3 b5 Ne5 h5 f3 h4 Bf2 Bb7 Be2 Nbd7 Nxd7",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O d4 Nxd4 Nxd4 exd4 e5 Ne8 Qxd4 Bb7 c4 bxc4 Qxc4",
    "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5 Nd5 Be7 Bxf6 Bxf6 c3 Bg5 Nc2 O-O a4 bxa4 Rxa4",
    "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5",
    "c4 Nf6 Nc3 e5 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7 a3 O-O b4 Be6 Rb1 f6 d3 Nd4 Nd2 c6 Nde4 Nd5 e3 Nxc3 Nxc3 Nf5 Qc2 Rc8",
    "e4 e5 Nf3 Nc6 Bb5 f5 d3 fxe4 dxe4 Nf6 O-O Bc5",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O b5 Bb3 Bc5 a4 Rb8 c3 d6 d4 Bb6 Na3 O-O axb5 axb5 Nxb5 Bg4 Bc2 Bxf3 gxf3 Nh5 f4 Nxf4 Bxf4 exf4 Qg4 Qf6 Ra6 Ne7 Na3 c6 Nc4 Bc7 Ra7 Rbc8 e5 dxe5 dxe5 Qh6 Rd1 Nd5 Be4 Rfd8 Rd3 g6 Bxd5 cxd5 Rxd5 Rxd5 Qxc8+ Kg7 Qg4 Bxe5 h4 Bb8 Rb7",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bc4 e6 Bb3 b5 O-O Be7 Qf3 Qb6 Be3 Qb7 Qg3 b4 Na4 Nbd7 f3 O-O Rfd1 Kh8 Kh1",
    "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5 Nd5 Be7 Bxf6 Bxf6 c3 Bg5 Nc2 Ne7 h4 Bh6",
    "e4 c5 Nf3 Nc6 Nc3 e6 d4 cxd4 Nxd4 Nf6 Ndb5 d6 Bf4 e5 Bg5 a6 Na3 b5 Bxf6 gxf6",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5 exd5 Nxd5 Nxe5 Nxe5 Rxe5 c6 d3 Bd6 Re1 Bf5 Qf3 Qh4 g3 Qh3 Bxd5 cxd5 Qxd5 Rad8 Qg2 Qxg2+ Kxg2 Bxd3 Be3 Rfe8 Nd2 b4 Bb6 Rxe1 Rxe1 Rb8 Ba5 bxc3 Bxc3 f6 Ne4 Bf8 f3 Rc8 Rd1 Bc4 a3 Bb5 g4",
    "e4 e5 Nf3 Nc6 Bb5 f5 d3 fxe4 dxe4 Nf6 O-O Bc5 Qd3 d6 Qc4 Qe7 Nc3 Bd7 Nd5 Nxd5 exd5 Nd4 Nxd4 Bxd4 Bxd7+ Qxd7 a4 a6 Be3 Bxe3 fxe3 O-O-O Rf2 Rdf8 Raf1 Qe7 Qe4 g6 Rf3 Kb8 b3 Rxf3",
    "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5 Bxf6 gxf6 Nd5 Bg7 Bd3 Ne7 Nxe7 Qxe7",
    "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3",
    "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 Ne5 Nbd7 Nxc4 Nb6 Ne5",
    "d4 d5 c4 e6 Nf3 Nf6 Nc3 Be7 Bg5 h6 Bxf6 Bxf6 Qc2 dxc4 e3 c5 dxc5",
    "d4 Nf6 c4 e6 Nc3 Bb4 Nf3 c5 g3 cxd4 Nxd4 O-O Bg2 d5 cxd5 Nxd5 Qb3 Qa5 Bd2 Nc6 Nxc6 bxc6 O-O Bxc3 bxc3 Ba6 Rfd1 Qc5 e4 Bc4 Qa4 Nb6 Qb4",
    "d4 d5 Nf3 Nf6 c4 dxc4 e3 e6 Bxc4 a6 O-O c5 dxc5 Bxc5 Qxd8+ Kxd8 Nbd2 Ke7 b3 Nbd7 Be2 b6 Ne1 a5 Bb2 Rd8 a4 Ba6 Bxa6 Rxa6 Nd3 Ne5 Nxc5 bxc5 Bc3 Rd3 Rac1 Ned7 e4 c4 b4 axb4 Bxb4+ Kd8 a5 Ne5 Nxc4 Nc6 Bc3 Nxe4 Bxg7 Ke7 Rfd1 Rxd1+ Rxd1 f6 Bh6 e5 Kf1 Nd4 Rb1 Rc6 Rb4 Nf5 Nb6 Nc5 Bd2 Na6 Rb3 Ke6 g4 Nd4 Rh3 Rc2 Be3 Ra2 Rh6 Nc5 Nc4 Ra4 Nd2 Rxa5 Rxh7 Ra4 h4 Nd3 Rh6 Ra1+ Kg2",
    "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O O-O Qe2 Nbd7 e4 Bg6 Bd3 Bh5 e5 Nd5 Nxd5 cxd5 Qe3 Re8 Ne1 Bg6 Bxg6 hxg6 Nd3 Qb6 Nxb4",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 Nc6 Qd2 O-O Bc4 Bd7 h4 Rc8 Bb3 h5 O-O-O Ne5 Bg5 Rc5 Kb1 Re8",
    "d4 d5 c4 c6 Nc3 Nf6 e3 e6 Nf3 Nbd7 Qc2 Bd6 g4 Nxg4 Rg1 Qf6 Rxg4 Qxf3 Rxg7 Nf6 h3 Qf5 Qxf5 exf5 cxd5 cxd5 Nb5 Bb4+ Bd2 Bxd2+ Kxd2 Ke7 Bd3 Be6 Nc7 Rag8 Nxe6 Kxe6 Rxg8 Nxg8 Ke2 Ne7 Kf3 Rc8 a4 Rc7 a5 h6 h4 Kf6 h5 Nc8 Kf4 Nd6 Rg1 Rc8 f3",
    "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 Bg5 h6 Bh4 dxc4 e4 g5 Bg3 b5 Ne5 h5 h4 g4 Be2 Bb7 O-O Nbd7 Qc2 Nxe5",
    "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 Nc3 Nxc3 dxc3 Be7 Be3 Nc6 Qd2",
    "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Qc2 Bd6 g4 h6 Bd2 dxc4 Bxc4 b5 Be2 Bb7 e4 Be7 g5 hxg5 Nxg5 b4 Na4 c5 Nxc5 Nxc5 dxc5 Rc8 Qa4+ Bc6 Bb5 Bxb5 Qxb5+ Qd7 Qxd7+ Nxd7 Ke2 Rh4 Rac1 Rxc5 Rxc5 Bxc5 f4 e5 h3 exf4 Nf3 Rh6 Bxf4 Re6 Nd2 Bd4 Rb1 Ra6 a3 bxa3 bxa3 Rxa3 Nc4 Ra2+ Kd3 Bf2 Bd6 Nb6 Bb4 Nxc4 Kxc4 Bb6 Kd5 Rg2 Rb3 Rg5+ e5 Bc7 Bd6 Bxd6 Kxd6 Rg6+ Kd5 Rb6 Rc3 Kd7 Rf3 Ke7 Rc3",
    "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7 c4 Nb4 Be2 O-O Nc3 Bf5 a3 Nxc3 bxc3 Nc6 Re1 Re8 cxd5 Qxd5 Bf4 Rac8 a4 Bd6 Be3 Na5 Nd2",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3",
    "Nf3 d5 g3 Bg4 Bg2 e6 O-O Nd7 d4 c6 Nbd2 Ngf6 Re1 Be7 e4 dxe4",
    "d4 d5 c4 c6 Nc3 Nf6 e3 a6 Nf3 b5 b3 Bg4 Bd2 Nbd7 h3 Bxf3 Qxf3 b4 Na4 e5 Rc1 Bd6 cxd5 cxd5 dxe5 Nxe5 Qd1 O-O Be2 a5 Rc2 Qe7 Bc1 Rad8",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O h3 Bb7 d3 d5",
    "e4 c5 c3 Nf6 e5 Nd5 Nf3 Nc6 Bc4 e6 d4 cxd4 cxd4 d6 O-O Be7 Qe2 O-O Nc3 Nxc3 bxc3 dxe5 dxe5 Qa5 a4 Rd8 Bd2 Bd7 Bd3 Be8 Rfe1 Rd7 Qe4 g6 Bb5 Rc8 Bg5",
    "e4 c5 Nf3 Nc6 Bb5 e6 O-O Nge7",
    "d4 Nf6 c4 e6 Nf3 c5 d5 d6 Nc3 exd5 cxd5",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 Ng4 Bc1 Nf6 h3 Nc6 g4 Qb6 Nde2 e6 Bg2 Be7 b3 h6 Qd2 g5 Ba3 Ne5 O-O-O Qxf2 Bxd6 Bxd6 Qxd6 Nfd7 Nd4 Qf6 Qa3 Qe7 Qb2 O-O Nf5 exf5",
    "d4 Nf6 c4 e6 Nf3 d5 Nc3 dxc4 e4 Bb4 Bg5 h6 Bxf6 Qxf6 Bxc4 c5 O-O cxd4 e5 Qd8 Ne4 O-O Qe2 Bd7 Rfd1 Nc6 a3 Be7 b4 Qb8 Ng3 b5 Bxb5 Nxe5 Bxd7 Nxd7 Nxd4 Ne5 Nb3 a6 Ne4 Qb5 Qxb5 axb5 Nd4 Rfd8 Nxb5 Rxd1+ Rxd1 Nc4 Nec3 Nxa3 Ra1 Bxb4 Nb1 Nxb5 Rxa8+ Bf8 h4 Nc7 Rc8 Nd5 Nd2 g6 Nc4 Kg7 g3 h5 Kg2 Bb4 Rb8 Kf6 Rb7 Bf8 Kf3 Bc5 Nd2 Kg7 Ne4 Be7 Ng5 Kf8 Ke2 Nf6 Kd3 Ng4 Nh7+ Ke8 Rb8+ Kd7 Ke2 Bd6 Rb7+ Ke8 Ng5 Nh6 Ne4 Nf5 Nxd6+ Nxd6 Ra7 Kf8 Kf3 Kg7",
    "c4 Nf6 Nc3 e5 Nf3 Nc6 g3 Nd4 Bg2 Nxf3+ Bxf3 Bb4 O-O O-O Bg2 Re8 d3 h6 Bd2 c6 Rc1 Bc5 a3 a6 Na4 Ba7",
    "d4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7 Nc3 O-O Rc1",
    "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 Nc3 Nxc3 dxc3 Be7 Be3 O-O Qd2 Nd7 O-O-O Re8 h4 c6 h5 h6 Kb1 Nf6 Bd3 Bf8",
    "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Nxc6 Qf6 Qf3 bxc6 Nc3 d6 Qg3 Qg6 Bd3 a5 Bd2 Nf6 f3 Ba6 Ne2 Nd7 Bxa6 Rxa6 Qxg6 hxg6 Nf4 Bd4 Nd3 c5 c3 Bf6 O-O-O a4 Kc2 g5 h3 Be7 Nf2 Nf8 Ng4 Ne6 Ne3 f6 Nc4 Kf7 Be1 Nf4 Rd2 g6 Bg3 Nh5 Bh2 Ng7 Bg3 Nh5 Bh2 Ng7 Re1 Rb8 Rdd1 Rba8 Rd2 Rb8 Ra1 Rba8 Rc1 Rb8 Bg3 Nh5 Bh2 Ng7 Rg1 Rh8 Rf1 Rh7 Rd3 Rh8 Rdd1 Ne6 Rh1 Ng7 Rhe1 Rha8 Bg1 Ne6 Rd2 Rh8 Be3 Bf8 Rh1 Bg7 Rd5 Ke7 Rh2 Raa8 Rh1 Ra6 Rd2 Raa8 Re1 Ra6 Bf2 Raa8 Bg3 Ra6 Ne3 Kf7 Rd5 Bf8 Rdd1 Bg7 Rh1 Raa8 Rh2 Ra6 Rdh1 Raa8 h4 gxh4 Rxh4 Rxh4 Rxh4 Ra7 Rh1 Ra8 Bf2 Nf8 Be1 Ra7 Bd2 Ne6 Bc1 Ra8 Bd2 Rd8 Bc1 Re8 Rh4 Ra8 Kd3 Ra6 g3 Nf8 f4 Nd7 Rh2 Ra7 Bd2 Rb7 Be1 Bf8 g4 Kg7 Bg3 c6 f5 g5 Rd2 Nb6 Ke2 Rd7 b3 d5 c4 axb3 axb3 dxe4 Rxd7+ Nxd7 Bc7 Kf7 Nd1 Ke8 Nc3 Be7 Nxe4 Bd8 Nd6+ Ke7 Nc8+ Ke8 Nd6+ Ke7 Nc8+ Ke8 Bg3 Nb6 Nd6+ Kf8 Nb7 Ke8 Nxc5 Be7 Ne4 Kd8 Be1 Nd7 Bc3 c5 Bb2 Ke8 Kf2 Kd8 Kg2 Ke8 Kh3 Kf7 Kg3 Ke8 Bc3 Kd8 Kh3 Kc7 Bb2 Kc6 Nc3 Nb6 Kg3 Bd8 Kf3 Be7 Ke3 Bd8 Kd3",
    "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Na6 Re1 Qe8 Bf1 c6 Rb1 Bg4 d5 c5 Be2 Kh8",
    "e4 e6 d4 d5 Nd2 Be7 Ngf3 Nf6 e5 Nfd7 Bd3 c5 c3 b6 Qe2 a5 a4 Ba6 Bxa6 Nxa6 O-O Qc8 Re1 Nc7 Nf1 Qa6 Qe3",
    "e4 c5 c3 d5 exd5 Qxd5 d4 Nf6 Nf3 e6 Be3 Be7 dxc5 Qxd1+ Kxd1 O-O Nbd2 Ng4 Nb3 Nxe3+ fxe3 Nd7 c6 bxc6 Na5 Bc5 Nd4 Nf6 Bc4 Ng4 Ke2 e5 Nc2 Bf5 h3 Nf6 Nb4 Be4 Nbxc6 Rfe8 Rhg1 Bb6 b4 Rac8 b5 Bxa5 Nxa5 Rc5 a4 Rec8 Bd3 Bxd3+ Kxd3 Rxc3+ Ke2 Rc2+ Kf3 e4+ Kf4 R8c5 Nc6 g5+ Kg3",
    "e4 e6 d4 d5 Nc3 Nf6 Bg5 dxe4 Nxe4 Nbd7 Nxf6+ Nxf6 c3 h6 Bh4 c5 Bxf6 gxf6 Qf3 cxd4 Bb5+ Ke7 Ne2 Qd5 Qxd5 exd5 Nxd4 f5 O-O-O Kf6",
    "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O",
    "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Be2 O-O Nf3 e5",
    "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Nge2 d5 cxd5 exd5 g3 Re8 Bg2 Bf8 O-O Na6 a3 c6 f3 c5 g4 h6 h3 b6 Ng3 Bb7 f4",
    "e4 e6 d4 d5 Nd2 c5 Ngf3 cxd4 Nxd4 Nf6 exd5 Qxd5 Nb5 Na6 c4 Qc6 a3 Be7 b4 O-O Qf3 Nb8 Rb1 a5 bxa5 Qxf3 Nxf3 Rxa5 Be2 Nbd7 O-O b6 Bd2 Ra4 Bb4 Nc5 Rfd1 Bb7 Ne5 Ba8 f3 Rb8 Rd2 Ne8 Nd7 Rb7 Rbd1 g5 Nxc5 bxc5 Bc3 Rb8 Be5 Rc8 Rd7 Bf6 Nd6 Bc6 Nxc8 Bxd7 Bxf6 Nxf6",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 Nc6 Qd2 O-O O-O-O d5 Kb1 Nxd4 e5 Nf5 exf6 exf6 Bc5 d4 Bxf8 Qxf8 Nb5 Ne3 Rc1 Bh6 Qxd4 Nf5 Qc3 Bxc1 Kxc1 Bd7 Bd3 Rc8 Qd2 Bxb5 Bxb5 Qc5 Bd3 Ne3",
    "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Nd5 Nxd5 exd5 Nb8 a4 Be7",
    "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 Nc3 Nxc3 dxc3 Be7 Be3 Nc6 Qd2 Be6 O-O-O Qd7 Kb1 Bf6 Bg5 Bxg5 Nxg5 O-O-O",
    "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6 a3 Ba5 cxd5 exd5 dxc5 Bxc3 bxc3 Bg4 c4 Ne5 cxd5 Bxf3 gxf3 Nxd5 Bb2 Nxe3 Bxh7+ Kxh7 Qb1+ Ng6 fxe3 Qg5+ Kh1 Qxe3 Qf5 Qf4 Qh5+ Qh6 Qxh6+ Kxh6 f4 f6 f5 Ne5 Rae1",
    "d4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 d5 Nf3 dxc4 Qxc4 b6 Bg5 Ba6 Qa4 Bb7 e3 Nbd7 Ba6 Bxa6 Qxa6 c5 Rc1 cxd4 exd4 h6 Bh4 b5 Bxf6 Nxf6 Qxb5 Rb8 Qa6 Rxb2 Qxa7 Qa8 Qxa8 Rxa8 O-O Ra2 Rc3 Nd5 Rb3 R2xa3 Rxa3 Rxa3 Rb1 f6 h4 g5 hxg5 hxg5 Nd2 Ra4 Rb8+ Kf7 Nb3 Nf4 g3 Nh3+ Kg2 g4 Nc5 Rxd4 Rb7+ Ke8 Rb6 Rc4 Nd3 Kf7 Rb4 Rxb4 Nxb4 Ng5 Kf1 e5 Nd5 Ke6 Ne3 f5 Ke2 Nf3 Kd3 Nd4 Ng2 Nb5 Ne3 Nc7 Kc4 Ne8 Kc3 Nf6 Kd3 Nd5 Ng2 Kd6 Nh4 Ne7 Kc4 Kc6 Ng2 Nc8 Ne3 Nd6+ Kc3 Kb5 Kd3 Kc5 Kc3 Ne4+ Kd3 Nd6 Kc3 Kc6 Kd3 Kd7 Ke2 Ke6 Kd3 Kf6 Nd5+",
    "c4 c5 Nf3 Nc6 Nc3 g6 e3 Nf6 d4 cxd4 exd4 d5 cxd5 Nxd5 Bc4 Nb6 Bb3 Bg7 O-O O-O d5 Na5 h3 Nxb3 axb3 Bxc3 bxc3 Qxd5 Qe2 Qe6 Qb2 f6 c4 Qf7 Be3 Bd7 Ra5 Nc8 Rc5 Nd6 Rc7 Bc6 Bc5 Rad8 Nd4 Rd7 Rxd7 Bxd7 Qa3 a6 Bxd6 exd6",
    "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7 Be3 f5 f3 f4 Bf2 g5",
    "Nf3 Nf6 g3 g6 Bg2 Bg7 O-O O-O c4 c6 b3 Ne4 d4 d5 Bb2 Bf5 Nbd2 Nd7 Nh4 Nxd2 Qxd2 Be6 e4 dxe4 Bxe4 Bh3 Rfe1 Qc7 Nf3 Nf6 Bc2 Rad8 Qe3 Rfe8 Bc3 Qc8 Rad1 Bf5 Bxf5 Qxf5 Kg2 Qc8 h3 Qc7 Qe5 Nd5 Qxc7 Nxc7 Ba5 Rd7 Ne5 Bxe5",
    "d4 Nf6 c4 e6 Nf3 d5 g3 Bb4+ Bd2 Be7 Bg2 c6 O-O O-O",
    "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 Re1 Nd6 Nxe5 Be7 Bf1 Nxe5 Rxe5 O-O d4 Bf6 Re1",
    "e4 e5 Nf3 Nc6 Bb5 Nge7 Nc3 d6 d4 a6 Bc4 b5 Be2 exd4 Nd5 Ne5 Qxd4 c5 Qd1 Nxd5 Qxd5 Be6 Qd1 Be7 O-O O-O c3 Qb6 Ng5 Bc8 Qc2 Bb7 Rd1 Rad8 Nf3 Ng6 a4 Bc6 axb5 axb5 Be3 Rfe8 Nd2 Bf8 c4 b4 Bf1 Be7 f3 Nf8 Nb3 Ne6 Nc1 Bf6 Ne2 Be5 Qd2 Ra8 g3 Ba4 Rdc1 g6 Bg2 Bg7 Bh3 Qc7 Rab1 Bb3 Bf1 Qe7 Nf4 Nd4 Kg2 Qf6 Be2 Ba2 Nd5 Qd8 Bxd4 Bxd4 Ra1 b3 Re1 Qa5 Rad1",
    "d4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7 Bg2 c6 O-O d5 Qc2 Nbd7",
    "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Qxd4 Qxd4 Nxd4 Bd7 Nc3 O-O-O",
    "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 b4 Nh5 Re1 f5 Ng5",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6 Bg5 Bd7",
    "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3",
    "Nf3 d5 d4 Nf6 c4 c6 e3 Bf5 Nc3 e6 Nh4 Bg6 Be2 Nbd7 O-O Bd6 g3 O-O Nxg6 hxg6 Qb3 Rb8 Rd1 a6 Qc2 b5 c5 Bc7 f4 Ba5 Bf3 Bxc3 bxc3 Ne4 Kg2 f5 h4 Ndf6 Bd2 Nxd2 Qxd2 Rf7 Rdb1 Rfb7 Rb2 Kf7 Qc2 Qc7 a3 Ke7 Bd1 Ne4 Bf3 Nf6 Qd1 a5 Rab1 a4 Kf1 Ra7 Rg2 Rh8 Ke2 Raa8",
    "d4 Nf6 c4 e6 Nf3 Bb4+ Nbd2 O-O Qc2 c5 dxc5 Bxc5 a3 b6 b4 Be7 Bb2 d6 g4 Bb7 g5 Nh5 e3 a5 Rd1 axb4 axb4 Nd7 Rg1 Qc7 Bd3 g6",
    "Nf3 d5 g3 Nf6 Bg2 g6 O-O",
    "e4 c5 Nf3 Nc6 Nc3 e5 Bc4 d6 d3 Be7 Nd2 Nf6 Nf1 Nd7 Ne3 Nb6 Ned5 O-O Nxb6 axb6 O-O Bg5 a4 Bxc1",
    "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 Qe2 Qe7 d3 Nf6 Nc3 Qxe2+ Bxe2 Be7 O-O O-O h3 h6 Re1 Rd8 Nd4 Bf8 Bf3 c6 b4 Nbd7 g3 Nb6 Bg2 a5",
    "d4 Nf6 c4 e6 Nf3 d5 Nc3 Be7 Bf4",
    "d4 Nf6 Nf3 g6 e3 Bg7 c4 O-O Be2 c5 d5 d6 Nc3 e6 O-O exd5 cxd5 Na6",
    "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8",
    "Nf3 d5 g3 Bg4 Bg2 c6 O-O e6 d3 Bd6 c4 Ne7 cxd5 exd5 Nc3 O-O h3 Bh5 e4 Na6 exd5 cxd5 Re1 Nc6 d4 Nc7 a3 h6 b4 Rc8 Bb2 a6 Na4 a5 Nc5 axb4 axb4 Rb8 Qa4 Bxf3 Bxf3 Qf6 Qb3 Rfd8 Bg4 Nxd4 Bxd4 Qxd4 Red1 Qc4 Qxc4 dxc4 Nd7 Rxd7 Bxd7 Bxb4 Ra4 Bc5",
    "e4 e5 Nf3 Nc6 Bb5 Nf6 d3 Bc5 c3 O-O Nbd2 d6 h3 Ne7 d4 Bb6 dxe5 dxe5 Qe2 Ng6 g3 Qe7 Bd3 a5 Nc4 Bc5 Be3 Rd8 Bxc5 Qxc5 Ne3 h6 O-O-O Be6 Kb1 b5 c4 b4 Nd5 Nd7 Ne1 c6 Nc7 Rac8 Nxe6 fxe6 h4 Rf8 Bc2 Qe7 Nd3 Nc5 Qe3 Nxd3 Rxd3 Rfd8 Rhd1 Rxd3 Qxd3 Nf8 Ba4 Qc5 Rd2 Kf7 Bd1 Ra8 Qd6 Qxc4 Qxe5 Qb5 Qc7+ Kg8 Qd6",
    "e4 e5 Nf3 Nc6 Bb5 Nf6 d3 Bc5 Bxc6 dxc6 Nbd2 Be6 O-O Bd6 d4 Nd7 dxe5 Nxe5 Nxe5 Bxe5",
    "e4 e5 Nf3 Nc6 Bb5 Nf6 d3 Bc5 Bxc6 dxc6 Nbd2 Nd7 Nc4 O-O Bd2 Re8",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 h3 e5 Nde2 h5 Bg5 Be6 Bxf6 Qxf6 Nd5 Qd8 Qd3 g6 O-O-O Nd7 Kb1 Rc8 Nec3 Rc5 Be2 b5 a3 Nb6 g4 hxg4 Nxb6 Qxb6 hxg4 Rxh1 Rxh1 Bg7 Qe3 Qb7 Rd1 Qc7 g5 Qc6 Rg1 Qd7 Qg3 Rc8 Bg4 Bxg4",
    "c4 e5 d3 Nc6 Nf3 f5 g3 Nf6 Bg2 Bb4+",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O",
    "d4 d5 c4 c6 Nf3 Nf6 e3 Bg4 h3 Bh5 cxd5 cxd5 Nc3 e6 g4 Bg6 Ne5 Nfd7 Nxg6 hxg6 Bg2 Nc6 e4 dxe4 Nxe4 Bb4+ Nc3 Nb6 O-O O-O d5 exd5 Nxd5 Bc5 Nc3 Bd4 Qf3 Qf6 Qxf6 Bxf6 Bf4 Rad8 Rad1 Bxc3 bxc3 Na4 c4 Nc3 Rd2 Rxd2 Bxd2 Ne2+ Kh2 Rd8 Be3 Nc3",
    "d4 Nf6 c4 e6 Nf3 d5 Nc3 c5 cxd5 Nxd5 e4 Nxc3 bxc3 cxd4 cxd4 Bb4+ Bd2 Bxd2+ Qxd2 O-O Bc4 Nd7 O-O b6 a4 Bb7 Rfe1 Nf6 Bd3 h6 a5 a6 axb6 Qxb6 Rab1 Qc7 Rbc1 Qe7 Qa5 Rfc8 Rxc8+ Rxc8 Nd2 Qd7 Qb6 Rc3 Bxa6 Bxa6 Qxa6 Qxd4 Nf3 Qc5 e5 Nd5 Qa8+ Kh7 Qb7 Rc1 Qb2 Rc2 Qd4 g5 g3 Kg7 Qxc5 Rxc5 Re4 Kg6 h3 Ne7 h4 Kf5 Ra4 Nc6 hxg5 hxg5 g4+ Kg6 Re4 Ne7 Kg2 Nd5 Kg3 Rc3 Re1 Ra3 Re4 Ra8 Rc4 Rh8 Re4 Nc3 Re3 Rc8 Re1 Rc4",
    "Nf3 d5 c4 e6 d4 Nf6 g3 Be7 Bg2 O-O O-O dxc4 Qa4 a6 Qxc4 b5 Qc2 Bb7 Bd2 Bd6 Ng5 Bxg2 Kxg2 Nbd7",
    "e4 c5 Nf3 d6 Bb5+ Nd7 d4 cxd4 Qxd4 a6 Bxd7+ Bxd7 Nc3 e5 Qd3 Rc8 O-O h6 Nd2 Qc7 Rd1 Bg4 f3 Be6 Nf1 Nf6 Ne3 Be7",
    "d4 Nf6 Nf3 d5 Bf4 c5 e3 Nc6 Nbd2 e6 c3 cxd4 exd4 Nh5 Bg5 f6",
    "d4 Nf6 Nf3 g6 g3 Bg7 Bg2 d5 O-O O-O Nbd2 Nc6 b3 e5 dxe5 Ng4 c4 d4 Ne4 Ngxe5 Nxe5 Nxe5 Bg5 f6 Bc1 f5",
    "e4 c6 d4 d5 e5 c5 dxc5 Nc6 Nf3 Bg4 c3 e6",
    "d4 Nf6 c4 e6 Nf3 d5 Nc3 Be7 Bf4 O-O e3 Nbd7 c5 Nh5 Bd3 Nxf4 exf4 b6 b4 a5 a3 c6 O-O Ba6 Re1 Bf6 Ne5",
    "c4 Nf6 d4 e6 Nf3 d5 Nc3 Be7 Bf4 O-O e3 Nbd7 c5 c6 h3 b6 b4 a5 a3 h6 Be2 Ba6 O-O Qc8 Rb1 Bxe2 Qxe2 axb4 axb4 Qb7 Rfc1 Rfc8 Ne1 Bd8 Qd1 Bc7",
    "e4 e5 Nf3 Nc6 Bb5 Nf6 d3 Bc5 c3 O-O O-O",
    "d4 d5 Nf3 Nf6 c4 dxc4 e3 e6 Bxc4 c5 O-O a6 b3 cxd4 Nxd4 Bd7 Bb2 Nc6 Nf3 Be7 Nbd2 O-O",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O a4 b4 a5 d6 d3 Be6 Bxe6 fxe6 Nbd2 Qb8 Nb3 Nd8 d4 exd4 Qxd4 c5 Qc4 Nd7 Be3 Bf6 Ra2 Re8 Nbd2 Nf7 Qb3 Qb5 Rd1 Nde5 Nxe5 Nxe5 Qa4 Qxa4 Rxa4 Rac8 h3 g5 c3 d5 exd5 exd5",
    "d4 Nf6 c4 e6 Nf3 d5 Nc3",
    "Nf3 c5 c4 Nf6 Nc3 d5 cxd5 Nxd5 e4 Nb4 Bc4 Nd3+ Ke2 Nf4+ Kf1 Ne6 d4 cxd4 Bxe6 Bxe6",
    "d4 Nf6 c4 e6 Nf3 d5 Nc3 Be7 Bf4 O-O e3 b6",
    "c4 e5 g3 Nf6 Bg2 c6 Nf3 e4 Nd4 Qb6 Nc2 d5 O-O dxc4 Nc3 Na6 d3 exd3 exd3 Be7 Re1 Be6 dxc4 O-O Be3 Qa5 Bd2 Qb6 Na4 Qd8 b3 Re8 Bc3",
    "e4 c5 Nf3 d6 Bb5+ Nd7 c3 Nf6 Bd3 Ne5 Be2 Nxf3+",
    "e4 g6 d4 Bg7 Nf3 d6 Bc4 e6",
    "Nf3 d5 e3 Nf6 c4 c6 b3",
    "e4 e6 d4 d5 e5 c5 c3 Bd7 Nf3 Qb6 a3 Bb5 dxc5 Bxc5 Bxb5+ Qxb5 b4 Bb6 a4 Qc4 a5 Qe4+ Qe2 Qxe2+ Kxe2 Bc7 c4 Ne7 Bg5 Nbc6 Bxe7 Kxe7 cxd5 exd5 Nc3 Rhd8",
    "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6",
    "e4 e5 Nf3 Nc6 Bb5 f5 d3 fxe4 dxe4 Nf6 O-O d6 Bc4 Bg4 h3 Bh5 Nc3 Nd4 g4 Nxf3+ Qxf3 Bg6 Be6 c6 Be3 Qe7 Bb3 Bf7 Rfd1 a6 Qg3 b5 f4 Bxb3 axb3 g6 b4 Qe6 Qf3 exf4 Bxf4 Nd7 e5 d5 Rd4 Bg7 Bg3 Bxe5 Rd3 Bxg3 Qxg3 O-O Re1 Qf6 Rd2 Rae8 Rxe8 Rxe8 Rf2",
    "d4 Nf6 Bf4 d5 e3 c5 c3 Nc6 Nd2 Qb6 Qb3 Nh5 Qxb6 axb6 Bc7 cxd4 exd4 e5 Bxe5 Nxe5 dxe5 Bc5 g3 O-O Be2 g6 Bxh5 gxh5 Ngf3 f6 b4 Be7 e6 Bxe6 Nd4 Bd7 N2b3 f5 f4 Bf6 Kd2 Rfe8 Rhe1 Re4 h4 Kf7 Re3 Ra3 Nc2 Ra8 Nbd4 Kg6 Rd3 Rae8 Re1 Rxe1 Nxe1",
    "e4 e5 Nf3 Nc6 Bb5 Nf6 d3 Bc5 c3 d5",
    "Nf3 c5 c4 Nf6 Nc3 d5 cxd5 Nxd5 e3 Nxc3 bxc3 g6 Bb5+ Bd7 Be2 Bg7 O-O O-O d4 Bc6 Ba3 cxd4 cxd4 Re8 Ne5 Qa5",
    "Nf3 Nf6 c4 c6 d4 d5 e3 Bf5 Nc3 e6 Nh4 Bg6 Be2 Nbd7 O-O Bd6 g3 Qe7 b3 Ne4 Bb2 Nxc3 Bxc3 Bb4 Bxb4 Qxb4 c5 O-O a3 Qa5 Nxg6 hxg6 b4 Qc7 f4 a6 Bd3 f5 Qe2 Nf6 Kg2 Qe7 a4 Ne4 h4 Ra7 Rh1 Nf6 Qb2 Rfa8 Be2 Qf8 Qc2 Kf7 Rab1 Qe7 Rb3 Rh8 Bf3 Rha8 Qe2 Rh8 Rhb1 Ne4 Qe1 Nf6 R1b2 Rha8 Qb1 Qd8 Ra2 Ng8 Qb2 Ne7 Be2 Qd7 Ra1 Ng8 Rba3 Ne7 Rh1 Ng8 Bd3 Nf6",
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Na5 Bc2 c5 d4 Nd7 d5 Nb6 Nbd2 g6 b4 Nb7 Nf1 a5 Bh6 Re8 a3 Bd7 Ng3 Qc7 Bd3 axb4 axb4 Rxa1 Qxa1 Ra8 Qb1 c4 Bc2 f6 Be3 Nd8 Nd2 Nf7 f4 exf4 Bxf4 Ne5 Be3 Ra3 Ne2 Na4",
    "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6",
    "e4 e5 Nf3 Nc6 Bb5 f5 Nc3 fxe4 Nxe4 d5 Nxe5 dxe4 Nxc6 Qg5 Qe2 Nf6 f4 Qxf4 d4 Qd6 Ne5+ c6 Bc4 Be6 c3 Bxc4 Qxc4 Qd5 Qb3 Bd6 Qxb7 O-O Qxc6 Qxc6 Nxc6 Ng4 Ne5 Bxe5",
    "d4 Nf6 c4 e6 Nf3 d5 Nc3 Bb4 Bg5 Nbd7 cxd5 exd5 Qc2 c5 dxc5 h6 Bd2 O-O e3 Bxc5 Rc1 Qe7 Be2 a6 Qd3 Nb6 O-O Bg4 Nd4 Bd7 Bf3 Rfe8 b3 Ba3 Rc2 Rac8 Nce2 Rxc2 Qxc2 Be6 Bc1 Rc8 Bxa3 Qxa3 Qd2 Bg4 Bxg4",
    "d4 d5 c4 c6 cxd5 cxd5 Nc3 Nf6 Nf3 Nc6 Bf4 Bf5 Qb3 Qb6 Qxb6 axb6 e3 e6 a3 Be7 Be2 O-O",
];
/*
    Replace all tips
    ^.{0, x}$ - less than x characters
     .{0, x}$ - last x characters (start with space)
*/

for (let i = 0; i < book_games_just_moves.length; i++) {
    let res = book_games_just_moves[i];
    let new_res = "";
    let move = 1;
    let space_count = 2;
    for (let j = 0; j < res.length; j++) {
        if (space_count == 2) { 
            if (move > 10) { break; }
            new_res += move + ". "; 
            space_count = 0; 
            move++;
        }
        if (res[j] == " ") { space_count++; }
        new_res += res[j];
    }
    book_games.push(new_res);
}

function book_move() {
    if (document.getElementById("stored_fen").value != START_FEN) {
        return 0;
    }

    let res = [];
    // Find book games following current game
    let game_so_far = get_game_moves();
    for (let i = 0; i < book_games.length; i++) {
        if (book_games[i].startsWith(game_so_far)) {
            res.push(i);
        }
    }
    if (!res.length) { return 0; }
    // Select random book game and extract next move
    let game = book_games[res[Math.floor(Math.random() * res.length)]];
    let move = "";
    let i = game_so_far.length;
    while (game[i].toLowerCase() == game[i].toUpperCase()) {
        i++;
    }
    while (i < game.length) {
        if (game[i] == " ") { break; }
        move += game[i];
        i++;
    }
    return create_move_san(move);
}

// SORT -----------------------------------------------------------------------------------------------------------------------------------------------

function swap(ary, a, b) {
    let t = ary[a];
    ary[a] = ary[b];
    ary[b] = t;
}

function insertion_sort(ary) {
    for (let i = 1, l = ary.length; i < l; i++) {
        let value = ary[i];
        for (var j = i - 1; j >= 0; j--) {
            if (ary[j][0] <= value[0])
                break;
            ary[j + 1] = ary[j];
        }
        ary[j + 1] = value;
    }
    return ary;
}

function shell_sort_bound(ary, start, end) { // error when start = 0, end = 1
    let inc = Math.round((start + end) / 2),
        i, j, t;
    while (inc >= start && inc > 0) {
        for (i = inc; i < end; i++) {
            t = ary[i];
            j = i;
            while (j >= inc && ary[j - inc][0] > t[0]) {
                ary[j] = ary[j - inc];
                j -= inc;
            }
            ary[j] = t;
        }
        inc = Math.round(inc / 2.2);
    }

    return ary;
}

function inplace_quicksort_partition(ary, start, end, pivotIndex) {
    let i = start, j = end;
    let pivot = ary[pivotIndex];

    while (true) {
        while (ary[i][0] < pivot[0]) { i++ };
        j--;
        while (pivot[0] < ary[j][0]) { j-- };
        if (!(i < j)) {
            return i;
        }
        swap(ary, i, j);
        i++;
    }
}

function fast_quicksort(ary) {
    if (ary.length <= 1) { return ary; }
    let mid = Math.floor(ary.length / 2);

    let stack = [];
    let entry = [0, ary.length, 2 * Math.floor(Math.log(ary.length) / Math.log(2))];
    stack.push(entry);
    while (stack.length > 0) {
        entry = stack.pop();
        let start = entry[0];
        let end = entry[1];
        let depth = entry[2];
        // console.log(start, end, depth);
        if (depth == 0) {
            ary = shell_sort_bound(ary, start, end);
            continue;
        }
        depth--;
        let pivot = Math.round((start + end) / 2);

        let pivotNewIndex = inplace_quicksort_partition(ary, start, end, pivot);
        if (end - pivotNewIndex > mid) {
            entry = [pivotNewIndex, end, depth];
            stack.push(entry);
        }
        if (pivotNewIndex - start > mid) {
            entry = [start, pivotNewIndex, depth];
            stack.push(entry);
        }
    }
    ary = insertion_sort(ary);
    return ary;
}

// EVALUATE -----------------------------------------------------------------------------------------------------------------------------------------------

let piece_values = [
    82, 337, 365, 477, 1025, 0, // opening material score
    94, 281, 297, 512, 936, 0 // endgame material score
];

let piece_position_values = [
    [   0,   0,   0,   0,   0,   0,  0,   0, //pawn
        98, 134,  61,  95,  68, 126, 34, -11,
        -6,   7,  26,  31,  65,  56, 25, -20,
        -14,  13,   6,  21,  23,  12, 17, -23,
        -27,  -2,  -5,  12,  17,   6, 10, -25,
        -26,  -4,  -4, -10,   3,   3, 33, -12,
        -35,  -1, -20, -23, -15,  24, 38, -22,
        0,   0,   0,   0,   0,   0,  0,   0,
    ],
    [   -167, -89, -34, -49,  61, -97, -15, -107, // knight
        -73, -41,  72,  36,  23,  62,   7,  -17,
        -47,  60,  37,  65,  84, 129,  73,   44,
        -9,  17,  19,  53,  37,  69,  18,   22,
        -13,   4,  16,  13,  28,  19,  21,   -8,
        -23,  -9,  12,  10,  19,  17,  25,  -16,
        -29, -53, -12,  -3,  -1,  18, -14,  -19,
        -105, -21, -58, -33, -17, -28, -19,  -23,
    ],
    [   -29,   4, -82, -37, -25, -42,   7,  -8, // bishop
        -26,  16, -18, -13,  30,  59,  18, -47,
        -16,  37,  43,  40,  35,  50,  37,  -2,
        -4,   5,  19,  50,  37,  37,   7,  -2,
        -6,  13,  13,  26,  34,  12,  10,   4,
        0,  15,  15,  15,  14,  27,  18,  10,
        4,  15,  16,   0,   7,  21,  33,   1,
        -33,  -3, -14, -21, -13, -12, -39, -21,
    ],
    [   32,  42,  32,  51, 63,  9,  31,  43, // rook
        27,  32,  58,  62, 80, 67,  26,  44,
        -5,  19,  26,  36, 17, 45,  61,  16,
        -24, -11,   7,  26, 24, 35,  -8, -20,
        -36, -26, -12,  -1,  9, -7,   6, -23,
        -45, -25, -16, -17,  3,  0,  -5, -33,
        -44, -16, -20,  -9, -1, 11,  -6, -71,
        -19, -13,   1,  17, 16,  7, -37, -26,
    ],      
    [   -28,   0,  29,  12,  59,  44,  43,  45, // queen
        -24, -39,  -5,   1, -16,  57,  28,  54,
        -13, -17,   7,   8,  29,  56,  47,  57,
        -27, -27, -16, -16,  -1,  17,  -2,   1,
        -9, -26,  -9, -10,  -2,  -4,   3,  -3,
        -14,   2, -11,  -2,  -5,   2,  14,   5,
        -35,  -8,  11,   2,   8,  15,  -3,   1,
        -1, -18,  -9,  10, -15, -25, -31, -50,
    ],
    [   -65,  23,  16, -15, -56, -34,   2,  13, // king
        29,  -1, -20,  -7,  -8,  -4, -38, -29,
        -9,  24,   2, -16, -20,   6,  22, -22,
        -17, -20, -12, -27, -30, -25, -14, -36,
        -49,  -1, -27, -39, -46, -44, -33, -51,
        -14, -14, -22, -46, -44, -30, -15, -27,
        1,   7,  -8, -64, -43, -16,   9,   8,
        -15,  36,  12, -54,   8, -28,  24,  14,
    ],
    // Endgame positional piece scores //
    [   0,   0,   0,   0,   0,   0,   0,   0, //pawn
        178, 173, 158, 134, 147, 132, 165, 187,
        94, 100,  85,  67,  56,  53,  82,  84,
        32,  24,  13,   5,  -2,   4,  17,  17,
        13,   9,  -3,  -7,  -7,  -8,   3,  -1,
        4,   7,  -6,   1,   0,  -5,  -1,  -8,
        13,   8,   8,  10,  13,   0,   2,  -7,
        0,   0,   0,   0,   0,   0,   0,   0,
    ],
    [   -58, -38, -13, -28, -31, -27, -63, -99, // knight
        -25,  -8, -25,  -2,  -9, -25, -24, -52,
        -24, -20,  10,   9,  -1,  -9, -19, -41,
        -17,   3,  22,  22,  22,  11,   8, -18,
        -18,  -6,  16,  25,  16,  17,   4, -18,
        -23,  -3,  -1,  15,  10,  -3, -20, -22,
        -42, -20, -10,  -5,  -2, -20, -23, -44,
        -29, -51, -23, -15, -22, -18, -50, -64,
    ],
    [   -14, -21, -11,  -8, -7,  -9, -17, -24, // bishop
        -8,  -4,   7, -12, -3, -13,  -4, -14,
        2,  -8,   0,  -1, -2,   6,   0,   4,
        -3,   9,  12,   9, 14,  10,   3,   2,
        -6,   3,  13,  19,  7,  10,  -3,  -9,
        -12,  -3,   8,  10, 13,   3,  -7, -15,
        -14, -18,  -7,  -1,  4,  -9, -15, -27,
        -23,  -9, -23,  -5, -9, -16,  -5, -17,
    ],
    [   13, 10, 18, 15, 12,  12,   8,   5, // rook
        11, 13, 13, 11, -3,   3,   8,   3,
        7,  7,  7,  5,  4,  -3,  -5,  -3,
        4,  3, 13,  1,  2,   1,  -1,   2,
        3,  5,  8,  4, -5,  -6,  -8, -11,
        -4,  0, -5, -1, -7, -12,  -8, -16,
        -6, -6,  0,  2, -9,  -9, -11,  -3,
        -9,  2,  3, -1, -5, -13,   4, -20,
    ],
    [   -9,  22,  22,  27,  27,  19,  10,  20, // queen
        -17,  20,  32,  41,  58,  25,  30,   0,
        -20,   6,   9,  49,  47,  35,  19,   9,
        3,  22,  24,  45,  57,  40,  57,  36,
        -18,  28,  19,  47,  31,  34,  39,  23,
        -16, -27,  15,   6,   9,  17,  10,   5,
        -22, -23, -30, -16, -16, -23, -36, -32,
        -33, -28, -22, -43,  -5, -32, -20, -41,
    ],
    [   -74, -35, -18, -18, -11,  15,   4, -17, // king
        -12,  17,  14,  17,  17,  38,  23,  11,
        10,  17,  23,  15,  20,  45,  44,  13,
        -8,  22,  24,  27,  26,  33,  26,   3,
        -18,  -4,  21,  24,  27,  23,   9, -11,
        -19,  -3,  11,  21,  23,  16,   7,  -9,
        -27, -11,   4,  13,  14,   4,  -5, -17,
        -53, -34, -21, -11, -28, -14, -24, -43
    ]
];

function get_gamephase_score() { return count_bits(BOARD[1]) * piece_values[1] + count_bits(BOARD[2]) * piece_values[2] + count_bits(BOARD[3]) * piece_values[3] + count_bits(BOARD[4]) * piece_values[4] + count_bits(BOARD[7]) * piece_values[7] + count_bits(BOARD[8]) * piece_values[8] + count_bits(BOARD[9]) * piece_values[9] + count_bits(BOARD[10]) * piece_values[10]; }

function evaluate_board() {
    let opening_res = 0;
    let endgame_res = 0;
    let bitboard;
    let index;
    for (let p = 0; p < 6; p++) {
        bitboard = copy_bitboard(BOARD[p]);
        while (bool_bitboard(bitboard)) {
            index = pop_lsb_index(bitboard);
            opening_res += piece_values[p] + piece_position_values[p][index];
            endgame_res += piece_values[p + 6] + piece_position_values[p + 6][index]; 
        }
        bitboard = copy_bitboard(BOARD[p + 6]);
        while (bool_bitboard(bitboard)) {
            index = pop_lsb_index(bitboard);
            // index += (7 - (index >> 3 << 1)) << 3; // flip rows
            index = (56 - (index & 56)) + (index & 7)
            opening_res -= piece_values[p] + piece_position_values[p][index];
            endgame_res -= piece_values[p + 6] + piece_position_values[p + 6][index]; 
        }
    }

    // Endgame active king
    endgame_res += CENTRE_MANHATTAN[lsb_index(BOARD[5])] << 3;
    endgame_res -= CENTRE_MANHATTAN[lsb_index(BOARD[11])] << 3;

    let gamephase_score = get_gamephase_score();
    if (gamephase_score > opening_phase) { // OPENING
        return (TURN) ? -opening_res : opening_res;
    } else if (gamephase_score < endgame_phase) { // ENDGAME
        return (TURN) ? -endgame_res : endgame_res;
    }
    // MIDDLEGAME
    let res = (opening_res * gamephase_score + endgame_res * (opening_phase - gamephase_score)) / opening_phase << 0;
    return (TURN) ? -res : res;
}

function score_move(move, defenders, max_history) {
    if (score_pv && move == pv_table[0][ply]) {
        score_pv = 0;
        return 150;
    }
    let res = 0;
    let target = get_move_target(move); 
    let piece = get_move_piece(move) % 6;

    let att_piece = is_square_attacked(target, TURN ^ 1);
    if (att_piece) {
        if (piece == 5) { return -150; } // moving into check

        if (!defenders && piece) { // piece sacrifice
            res = (-piece - 8) << 3; 
        } else if (piece > att_piece - 1 && !(piece == 2 && att_piece - 1 == 1)) { // attacked by lesser piece (not NxB)
            res = (-piece << 3) + att_piece;
        }
    }

    if (get_move_capture(move)) {
        let cap_piece = 0;
        for (let i = 0; i < 6; i++) { 
            if (get_bit(BOARD[6 * (TURN ^ 1) + i], target)) {
                cap_piece = i;
                break;
            }
        }
        if (cap_piece >= piece || (cap_piece == 1 && piece == 2)) { // capturing higher value piece (or BxN)
            res = 0; // remove att penalties
        }
        if (!att_piece) { res += 20; } // free piece
        return res + 60 + ((cap_piece - piece) << 2);
    }
    if (move == killer_moves[0][ply]) { return res + 60; }
    else if (move == killer_moves[1][ply]) { return res + 55; }
    return res + history_moves[get_move_piece(move)][target] / max_history * 50; // maps history moves between 0 and 50
    // return res + Math.min(50, history_moves[get_move_piece(move)][target]);
}

function order_moves(moves, best_move=0) {
    let max_history = 1;
    let defenders = new Array(64).fill(-1);
    for (let i = 0; i < moves.length; i++) {
        let move = moves[i];
        let piece = get_move_piece(move);
        let target = get_move_target(move);
        max_history = Math.max(max_history, history_moves[piece][target]);
        if (!(piece % 6) && !get_move_capture(move)) { continue; } // ignore pawn pushes
        defenders[target] += 1 + (piece % 6 ? 0 : 1); // count pawns twice
    }
    let res = [];
    for (let i = 0; i < moves.length; i++) {
        let move = moves[i];
        let score = (move == best_move) ? 160 : score_move(move, defenders[get_move_target(move)], max_history);
        res.push([score, moves[i]]);
    }
    // res.sort(function(a, b) { return b[0] - a[0]; });
    fast_quicksort(res);
    res.reverse(); // TODO - sort in correct order by default
    for (let i = 0; i < res.length; i++) {
        res[i] = res[i][1];
    }
    return res;
}

function enable_pv_scoring(moves) {
    follow_pv = 0;
    let pv_move = pv_table[0][ply];
    if (!pv_move) { return; }
    for (let i = 0; i < moves.length; i++) {
        if (moves[i] == pv_move) {
            follow_pv = 1;
            score_pv = 1;
            return;
        }
    }
}

// SEARCH -----------------------------------------------------------------------------------------------------------------------------------------------

function best_eval_captures(depth, alpha, beta) {
    COUNT++;

    let stand_pat = evaluate_board();
    if (stand_pat >= beta) { return beta; } // beta cutoff
    else if (stand_pat < alpha - 900) { return alpha; } // delta pruning
    else if (stand_pat > alpha) { alpha = stand_pat; }
    if (depth == 0 || ply > MAX_PLY) {  return stand_pat; }

    let moves = generate_capture_moves();
    moves = order_moves(moves);
    for (let i = 0; i < moves.length; i++) {
        let move = moves[i];

        let cb = copy_board(BOARD);
        let cc = CASTLE;
        let copy_en = EN_PASSANT_SQUARE;
        let ch = copy_bitboard(hash_key);

        if (!do_move(move)) {
            continue;
        }

        GAME_HASH.push(copy_bitboard(hash_key));
        ply++;
        let eval = -best_eval_captures(depth - 1, -beta, -alpha);
        ply--;
        GAME_HASH.pop();
    
        BOARD = cb;
        CASTLE = cc;
        EN_PASSANT_SQUARE = copy_en;
        TURN ^= 1;
        hash_key = ch;

        if (eval >= beta) { return beta; }
        if (eval > alpha) { alpha = eval; }
    }
    return alpha;
}

function best_eval(depth, alpha, beta) {
    pv_length[ply] = ply;
    if (ply && is_repetition()) { return 0; }

    let best_move = 0;
    let res = HASH_TABLE.get(depth, alpha, beta, best_move);
    if (ply && res != null) {
        LOOKUP++;
        return res;
    }

    if (depth == 0) { return best_eval_captures(8, alpha, beta); }
    else if (ply >= MAX_PLY) { return evaluate_board(); }

    let moves = generate_pseudo_moves();
    if (follow_pv) { enable_pv_scoring(moves); }
    moves = order_moves(moves, best_move);

    COUNT++;
    let hash_flag = 2;
    let legal_moves = false;
    for (let i = 0; i < moves.length; i++) {
        let move = moves[i];

        let cb = copy_board(BOARD);
        let cc = CASTLE;
        let copy_en = EN_PASSANT_SQUARE;
        let ch = copy_bitboard(hash_key);

        if (!do_move(move)) {
            continue;
        }
        legal_moves = true;

        GAME_HASH.push(copy_bitboard(hash_key));
        ply++;
        let eval = -best_eval(depth - 1, -beta, -alpha);
        ply--;
        GAME_HASH.pop();

        BOARD = cb;
        CASTLE = cc;
        EN_PASSANT_SQUARE = copy_en;
        TURN ^= 1;
        hash_key = ch;

        if (STOPPED) { return 0; }

        if (eval > alpha) {
            hash_flag = 1;
            if (!get_move_capture(move)) {
                history_moves[get_move_piece(move)][get_move_target(move)] += depth;
            }
            alpha = eval;
            best_move = move;

            pv_table[ply][ply] = move; // write PV move
            for (let next_ply = ply + 1; next_ply < pv_length[ply + 1]; next_ply++) { 
                pv_table[ply][next_ply] = pv_table[ply + 1][next_ply]; 
            }
            pv_length[ply] = pv_length[ply + 1];

            if (eval >= beta) { // oppenent response too strong, snip
                HASH_TABLE.set(depth, 3, eval, best_move);
                if (!get_move_capture(move)) {
                    killer_moves[1][ply] = killer_moves[0][ply];
                    killer_moves[0][ply] = move;
                }
                return beta;
            } 
        }
    }
    if (!legal_moves) {
        if (is_square_attacked(lsb_index(BOARD[6 * TURN + 5]), TURN ^ 1)) {
            return -100000 + ply;
        }
        return 0;
    }
    HASH_TABLE.set(depth, hash_flag, alpha, best_move);
    return alpha;
}

function search(search_time=750, override_depth=0) {
    reset_search_tables();
    if (is_repetition()) { return 0; }

    let move = book_move();
    if (move) {
        console.log("Book");
        pv_table[0][0] = move;
        return 0;
    } 

    let eval;
    let depth = 1;
    let start = performance.now();
    while ((performance.now() - start <= search_time || depth <= override_depth) && depth <= MAX_PLY) {
        follow_pv = 1;

        eval = best_eval(depth, -Infinity, Infinity);
        if (PLAYER_WHITE) { eval *= -1; }

        let res = "Depth: " + (depth) + ", analysed: " + (COUNT) + ", lookup: " + (LOOKUP) + ", eval: " + (eval) + ", hash overwrites: " + (HASH_OVERWRITES) + ", PV: ";
        let PV = "";
        for (let i = 0; i < pv_length[0]; i++) {
            PV += get_move_san(pv_table[0][i], false) + " ";
        }
        console.log(res + PV);
        depth++; 
    }
    let time = Math.round(performance.now() - start);
    console.log("Best move: %s\tEval: %d\tTime (ms): %d\tHash size: %d", get_move_san(pv_table[0][0], false), eval, time, Object.keys(HASH_TABLE.hashes).length);
    console.log(" ");
    return eval;
}

function perft(depth, print=1) {
    if (depth == 0) { return 1; }
    
    let res = 0;
    let moves = generate_pseudo_moves();
    for (let i = 0; i < moves.length; i++) {
        let cb = copy_board(BOARD);
        let cc = CASTLE;
        let copy_en = EN_PASSANT_SQUARE;
        let ch = copy_bitboard(hash_key);
        if (!do_move(moves[i])) {
            continue;
        }
        
        let start_res = res;
        res += perft(depth - 1, 0);   

        if (print) {
            console.log("%s\t->\t%d", get_move_uci(moves[i]), res - start_res);
        }

        BOARD = cb;
        CASTLE = cc;
        EN_PASSANT_SQUARE = copy_en;
        TURN ^= 1;
        hash_key = ch;
    }
    return res;
}

function id_perft(depth) {
    let res;
    let start = performance.now();
    for (let i = 1; i <= depth; i++) {
        res = perft(i, i == depth);
    }
    let time = performance.now() - start
    console.log("Nodes:  %d\tTime: %d\tNodes per sec: %d", res, time, res / time * 1000);
    console.log("Result: %d", PERFT_RESULTS[depth]);
}

function do_perft(depth) {
    let start = performance.now();
    let res = perft(depth);
    let time = performance.now() - start
    console.log("Nodes:  %d\tTime: %d\tNodes per sec: %d", res, time, res / time * 1000);
    console.log("Result: %d", PERFT_RESULTS[depth]);
}

let PERFT_RESULTS = [1, 20, 400, 8902, 197281, 4865609, 119060324, 3195901860, 84998978956];

// AI MAIN -----------------------------------------------------------------------------------------------------------------------------------------------

let opening_phase = 6192;
let endgame_phase = 518;

let ply = 0;
let MAX_PLY = 32;

let killer_moves;
let history_moves;

let pv_length; // ply
let pv_table; // ply, ply
let follow_pv;
let score_pv;

let hash_key;
let ZOB_TABLE;
let HASH_TABLE;
let HASH_SIZE = 4194304;

let STOPPED = 0;

let COUNT = 0;
let LOOKUP = 0;

// HTML ----------------------------------------------------------------------------------------------------------------------

function run_setup_board() {
    let button = document.getElementById("setup");
    if (button.style.backgroundColor == "rgb(187, 224, 174)") {
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

function randint(n) { return Math.floor(Math.random() * n); } // random 0..n

function play_rand_endgame(book) {
    let book_endgames = [
        "6k1/8/8/8/8/8/8/4BNK1 w - - 0 0", // BN
        "6k1/8/8/8/8/8/8/4BBK1 w - - 0 0", // BB
    ];
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
    ];
    let fen = book ? book_endgames[randint(book_endgames.length)] : endgames[randint(endgames.length)][0];
    PLAYER_WHITE = fen.split(" ")[1] == "w";
    document.getElementById("stored_fen").value = "";
    start_game(PLAYER_WHITE, fen, 8);
}

function undo_move() {
    GAME.pop();
    GAME.pop();
    if (!GAME.length) { return start_game(PLAYER_WHITE); }

    GAME_MOVES.pop();
    GAME_MOVES.pop();
    GAME_HASH.pop();
    GAME_HASH.pop();
    hash_key = copy_bitboard(GAME_HASH[GAME_HASH.length - 1]);
    BOARD = GAME[GAME.length - 1];
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

    if (split_fen.length != 6 || 
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
    FIFTY = parseInt(split_fen[4]);
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
        let piece_location = table.rows.item(i >> 3).cells.item(i & 7);
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

    let s_location = table.rows.item(move_source >> 3).cells.item(move_source & 7);
    let t_location = table.rows.item(move_target >> 3).cells.item(move_target & 7);

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
            let piece_location = table.rows.item(i >> 3).cells.item(i & 7);
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
         let piece_location = table.rows.item(pos >> 3).cells.item(pos & 7);
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
            let cell = table.rows.item(i >> 3).cells.item(i & 7);
            if (i == pos) { continue; }
            cell.onclick = function() {
                SELECTED_PIECE = 64;
                if (get_bit(BOARD[14], i)) { SELECTED_PIECE = i; }
                // Reset board colours
                for (let j = 0; j < 64; j++) {
                    let piece_location = table.rows.item(j >> 3).cells.item(j & 7);
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
            let move_location = table.rows.item(target >> 3).cells.item(target & 7);

            move_location.onclick = function() {
                SELECTED_PIECE = 64;
                doLegalMove(target);
            }
        }
    }

    function doLegalMove(new_pos) {
        let source = PLAYER_WHITE ? pos : 63 - pos;
        let target = PLAYER_WHITE ? new_pos : 63 - new_pos;
        let move = legal_move(source, target);
        if (move) {
            if (get_move_promote(move)) { // ask for promote input
                move |= 983040; // set promote 15
            }
            let san = get_move_san(move);
            if (do_move(move)) {
                if (get_move_promote(move) == 15) {
                    let letters = ["", "N", "B", "R", "Q", "K"];
                    for (let i = 0; i < 12; i++) {
                        if (get_bit(BOARD[i], target)) {
                            san += letters[i % 6];
                            break;
                        }
                    }
                }
                GAME.push(copy_board(BOARD));
                GAME_MOVES.push(san);
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
            let king_location = document.getElementById("chess-table").rows.item(king_pos >> 3).cells.item(king_pos & 7);
            king_location.style.background = "#FF0000"; // RED
            setTimeout(() => {
                king_location.style.background = "";
            }, 250);
        }
        return false;
    }
}

function doAiMove() {
    let evaluation = search(); 
    let best_move = pv_table[0][0];
    
    let san = get_move_san(best_move);
    if (!do_move(best_move)) {
        finish();
        return false;
    }

    GAME.push(copy_board(BOARD));
    GAME_MOVES.push(san);
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

    make_table();
    BOARD = make_board(fen);
    hash_key = init_hash();
    HASH_TABLE = new HashTable();

    document.getElementById("setup").style.backgroundColor = "";

    // Setup eval bar
    document.getElementById("eval-bar").style.height = "50%";
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
START_FEN = "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8";

let NUM_SQUARES_EDGE;
let DIR_OFFSETS;
let PAWN_ATTACK;
let KNIGHT_ATTACK;
let KING_ATTACK;

let ROW_MASKS; 
let COL_MASKS;
let CENTRE_MANHATTAN;

let PLAYER_WHITE;
let TURN; // 0 for white, 1 for black
let CASTLE;
let EN_PASSANT_SQUARE; // pawn moves 2 spots, record position behind pawn
let FIFTY;

let BOARD;
let GAME; // for easy undo move
let GAME_HASH;
let GAME_MOVES;

let HASH_OVERWRITES = 0;

initialise_constants();

let tricky_fen = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
start_game(true);