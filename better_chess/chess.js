// MOVE ----------------------------------------------------------------------------------------------------------------------
/* 
    Encoding
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
function print_move(move) {
    let pieces = "PNBRQKpnbrqk";
    let res = pieces[get_move_piece(move)] + " " + get_move_source(move) + " -> " + get_move_target(move);
    if (get_move_capture(move)) { res += " X"; }
    if (get_move_promote(move)) { res += " P"; }
    if (get_move_double(move)) { res += " D"; }
    if (get_move_enpassant(move)) { res += " E"; }
    if (get_move_castle(move)) { res += " C"; }
    console.log(res);
}
function get_move_source(move) { return move & 63; }
function get_move_target(move) { return (move & 4032) >> 6; }
function get_move_piece(move) { return (move & 61440) >> 12; }
function get_move_promote(move) { return (move & 983040) >> 16; }
function get_move_capture(move) { return (move & 1048576) >> 20; }
function get_move_double(move) { return (move & 2097152) >> 21; }
function get_move_enpassant(move) { return (move & 4194304) >> 22; }
function get_move_castle(move) { return (move & 8388608) >> 23; }
function get_move_desc(move, all_moves) { // all_moves for specific desc, eg. Nbg4
    let move_source = get_move_source(move);
    let move_target = get_move_target(move);

    // Check castle moves
    if (get_move_castle(move)) {
        if ((PLAYER_WHITE && move_source < move_target) || (!PLAYER_WHITE && move_source > move_target)) { // kingside
            return "O-O";
        }
        return "O-O-O";
    }

    let pieces = ["", "N", "B", "R", "Q", "K", "", "N", "B", "R", "Q", "K"];
    let letters = "abcdefgh";
    let srow = move_source >> 3; let scol = move_source % 8;
    let trow = move_target >> 3; let tcol = move_target % 8;

    if (PLAYER_WHITE) {
        trow = 7 - trow;
    } else {
        letters = "hgfedcba";
    }

    let res = pieces[get_move_piece(move)]; // piece letter

    // Disambiguate moves for pgn eg. Nge2
    if (all_moves != null) {
        for (let i = 0; i < all_moves.length; i++) {
            // Not this move, same piece not pawn, same target square
            let other_move = all_moves[i];
            if (move != other_move && get_move_piece(move) == get_move_piece(other_move) && get_move_piece(move) % 6 != 0 && move_target == get_move_target(other_move)) {
                if (scol == get_move_source(other_move) % 8) { // use numbers
                    if (PLAYER_WHITE) {
                        res += (8 - srow);
                    } else {
                        res += (srow + 1);
                    }
                } else { // use letters
                    res += letters[scol];
                }
            }
        }
    }

    // Check capture moves
    if (get_move_capture(move)) { 
        if (!res.length) { res += letters[scol]; } // pawn capture
        res += "x";
    }
    res += (letters[tcol]) + (trow + 1); // move notation

    // Check promotion moves
    let move_promote = get_move_promote(move);
    if (move_promote) { 
        if (!pieces[move_promote]) {
            res += "=Q"; 
        } else {
            res += "=" + pieces[move_promote]; 
        }
    }
    return res;
}

function get_desc_move(move_desc) {
    let moves = generate_pseudo_moves();
    for (let i = 0; i < moves.length; i++) {
        let desc = get_move_desc(moves[i], moves);
        if (move_desc == desc) { return moves[i]; }
    }
    return null;
}

// CASTLE ----------------------------------------------------------------------------------------------------------------------
/*
    Encoding
    0001    player king
    0010    player queen
    0100    ai king
    1000    ai queen
*/
function create_castle(array=[1,1,1,1]) {
    return (array[0]) | (array[1] << 1) | (array[2] << 2) | (array[3] << 3);
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
    if (!PLAYER_WHITE) {
        source += 7 - 2 * (source % 8); // flip cols
        target += 7 - 2 * (target % 8); // flip cols
    }
    hash_key = xor_bitboards(hash_key, ZOB_TABLE[65][castle]);
    castle &= CASTLING_RIGHTS[source];
    castle &= CASTLING_RIGHTS[target];
    hash_key = xor_bitboards(hash_key, ZOB_TABLE[65][castle]);
    return castle;
}

function print_castle(castle) {
    console.log(get_castle_pk(castle) + " " + get_castle_pq(castle) + ", " + get_castle_ak(castle) + " " + get_castle_aq(castle));
}
function get_castle_pk(castle) { return castle & 1; }
function get_castle_pq(castle) { return (castle & 2) >> 1; }
function get_castle_ak(castle) { return (castle & 4) >> 2; }
function get_castle_aq(castle) { return (castle & 8) >> 3; }
    
// BITBOARD ----------------------------------------------------------------------------------------------------------------------

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
    let res = new Array(8);
    for (let i = 0; i < 8; i++) {
        res[i] = new Array(8);
    }
    for (let i = 0; i < 64; i++) {
        res[i >> 3][i % 8] = get_bit(bitboard, i) ? 1 : 0;
    }
    console.log(res);
}

// BOARD ----------------------------------------------------------------------------------------------------------------------
/*
    12 piece bitboards, 3 occupancies
    player, ai
    pawn, rook, knight, bishop, queen, king
*/
function create_board(board) {
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
    for (let i = 0; i < 6; i++) { // player
        res[12] = or_bitboards(res[12], res[i]);
    }
    for (let i = 6; i < 12; i++) { // ai
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

function legal_move(pos, new_pos) {
    let moves = generate_pseudo_moves();
    for (let i = 0; i < moves.length; i++) {
        let move = moves[i];
        if (get_move_source(move) == pos && get_move_target(move) == new_pos) {
            return [moves, move];
        }
    }
    return [moves, false];
}

function print_board(board) {
    let res = [];
    for (let i = 0; i < 8; i++) {
        let row = [];
        for (let j = 0; j < 8; j++) {
            let k = 8 * i + j;
            let char = " ";
            if (get_bit(board[14], k)) {
                if (get_bit(board[12], k)) {
                    if (get_bit(board[0], k)) {
                        char = "p";
                    } else if (get_bit(board[1], k)) {
                        char = "n";
                    } else if (get_bit(board[2], k)) {
                        char = "b";
                    } else if (get_bit(board[3], k)) {
                        char = "r";
                    } else if (get_bit(board[4], k)) {
                        char = "q";
                    } else if (get_bit(board[5], k)) {
                        char = "k";
                    }
                    if (PLAYER_WHITE) {
                        char = char.toUpperCase();
                    }
                } else if (get_bit(board[13], k)) {
                    if (get_bit(board[6], k)) {
                        char = "p";
                    } else if (get_bit(board[7], k)) {
                        char = "n";
                    } else if (get_bit(board[8], k)) {
                        char = "b";
                    } else if (get_bit(board[9], k)) {
                        char = "r";
                    } else if (get_bit(board[10], k)) {
                        char = "q";
                    } else if (get_bit(board[11], k)) {
                        char = "k";
                    }
                    if (!PLAYER_WHITE) {
                        char = char.toUpperCase();
                    }
                }
            }
            row.push(char);
        }
        res.push(row);
    }
    console.log(res);
    console.log();
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

    if (get_move_capture(move)) {
        // for (let i = 6 * (TURN ^ 1); i < 6 * (TURN ^ 1) + 6; i++) {
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

    if (get_move_promote(move)) {
        let promote_piece = get_move_promote(move);
        if (promote_piece == 15) {
            let input = window.prompt("N B R Q: ").toUpperCase();
            let value = { "N": 1, "B": 2, "R": 3, "Q": 4 };
            if (!Object.keys(value).includes(input)) { input = "Q"; }
            promote_piece = piece + value[input];
        }
        pop_bit(BOARD[piece], target);
        set_bit(BOARD[promote_piece], target);
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[target][piece]);
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[target][promote_piece]);

    } else if (get_move_enpassant(move)) {
        if (TURN) {
            pop_bit(BOARD[0], target - 8);
            hash_key = xor_bitboards(hash_key, ZOB_TABLE[target - 8][0]);
        } else {
            pop_bit(BOARD[6], target + 8);
            hash_key = xor_bitboards(hash_key, ZOB_TABLE[target + 8][6]);
        }

    } else if (get_move_castle(move)) {
        if (PLAYER_WHITE) {
            switch(target) {
                case 62: // pk
                    pop_bit(BOARD[3], 63);
                    set_bit(BOARD[3], 61);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[63][3]);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[61][3]);
                    break;
                case 58: // pq
                    pop_bit(BOARD[3], 56);
                    set_bit(BOARD[3], 59);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[56][3]);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[59][3]);
                    break;
                case 6: // ak
                    pop_bit(BOARD[9], 7);
                    set_bit(BOARD[9], 5);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[7][9]);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[5][9]);
                    break;
                case 2: // aq
                    pop_bit(BOARD[9], 0);
                    set_bit(BOARD[9], 3);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[0][9]);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[3][9]);
                    break;
            }
        } else {
            switch(target) {
                case 57: // pk
                    pop_bit(BOARD[3], 56);
                    set_bit(BOARD[3], 58);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[56][3]);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[58][3]);
                    break;
                case 61: // pq
                    pop_bit(BOARD[3], 63);
                    set_bit(BOARD[3], 60);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[63][3]);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[60][3]);
                    break;
                case 1: // ak
                    pop_bit(BOARD[9], 0);
                    set_bit(BOARD[9], 2);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[0][9]);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[2][9]);
                    break;
                case 5: // aq
                    pop_bit(BOARD[9], 7);
                    set_bit(BOARD[9], 4);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[7][9]);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[4][9]);
                    break;
            }
        }
    } 
    
    // Re-validate constants
    if (EN_PASSANT_SQUARE) {
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[66][EN_PASSANT_SQUARE]);
    }
    EN_PASSANT_SQUARE = null;
    if (get_move_double(move)) {
        if (TURN) {
            EN_PASSANT_SQUARE = target - 8;
        } else {
            EN_PASSANT_SQUARE = target + 8;
        }
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[66][EN_PASSANT_SQUARE]);   
    }

    CASTLE = update_castle(CASTLE, source, target);

    // Update occupancies
    BOARD[12] = [0, 0];
    BOARD[13] = [0, 0];
    for (let i = 0; i < 6; i++) { // player
        BOARD[12] = or_bitboards(BOARD[12], BOARD[i]);
    }
    for (let i = 6; i < 12; i++) { // ai
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

// DEFINE MOVES ----------------------------------------------------------------------------------------------------------------------

function initialiseConstants() {   
    PAWN_ATTACK = pawn_attack(); // [side][square]
    KNIGHT_ATTACK = knight_attack(); // [square]
    KING_ATTACK = king_attack(); // [square]

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
}

function bishop_attack_fly(square, blocker) {
    let res = [0, 0];
    let r = square >> 3; let c = square % 8;
    let o = 1;
    while (r + o < 8 && c + o < 8) { // + +
        let i = 8 * r + 9 * o + c; // 8(r+o) + (c+o) = 8r + 9o + c
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (r + o < 8 && 0 <= c - o) { // + -
        let i = 8 * r + 7 * o + c; // 8(r+o) + (c-o) = 8r + 7o + c
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= r - o && c + o < 8) { // - +
        let i = 8 * r - 7 * o + c; // 8(r-o) + (c+o) = 8r - 7o + c
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= r - o && 0 <= c - o) { // - -
        let i = 8 * r - 9 * o + c; // 8(r-o) + (c-o) = 8r - 9o + c
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    return res; //.nand(occupancies[0]);
}
function rook_attack_fly(square, blocker) {
    let res = [0, 0];
    let r = square >> 3; let c = square % 8;
    let o = 1;
    while (r + o < 8) { // + .
        let i = 8 * r + 8 * o + c;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= r - o) { // - .
        let i = 8 * r - 8 * o + c;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (c + o < 8) { // . +
        let i = 8 * r + c + o;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= c - o) { // . -
        let i = 8 * r + c - o;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    return res; //.nand(occupancies[0]);
}
function queen_attack_fly(square, blocker) {
    return or_bitboards(bishop_attack_fly(square, blocker), rook_attack_fly(square, blocker));
}

// GENERATE MOVES ----------------------------------------------------------------------------------------------------------------------

function is_square_attacked(square, side) {
    // Attacked by player pawns
    if (!side && bool_bitboard(and_bitboards(PAWN_ATTACK[1][square], BOARD[0]))) { return 1; }
    // Attacked by ai pawns
    if (side && bool_bitboard(and_bitboards(PAWN_ATTACK[0][square], BOARD[6]))) { return 1; }
    // Attacked by knights
    if (bool_bitboard(and_bitboards(KNIGHT_ATTACK[square], side ? BOARD[7] : BOARD[1]))) { return 2; }
    // Attacked by bishops
    if (bool_bitboard(and_bitboards(bishop_attack_fly(square, BOARD[14]), side ? BOARD[8] : BOARD[2]))) { return 3; }
    // Attacked by rooks
    if (bool_bitboard(and_bitboards(rook_attack_fly(square, BOARD[14]), side ? BOARD[9] : BOARD[3]))) { return 4; }
    // Attacked by queens
    if (bool_bitboard(and_bitboards(queen_attack_fly(square, BOARD[14]), side ? BOARD[10] : BOARD[4]))) { return 5; }
    // Attacked by kings
    if (bool_bitboard(and_bitboards(KING_ATTACK[square], side ? BOARD[11] : BOARD[5]))) { return 6; }
    
    return 0;
}

function advanced_legal_move(move) {
    /*
        Determine if a move is legal or not

        Checkmask 
            -> when in check, a bitboard of positions that pieces can move to 
            -> take checking piece, block check
        Pinmask (8 possible, straight and diagonal)
            -> bitboard of path from king to checking piece
            -> pieces on this bitboard cannot move (unless to another square on bitboard then pin maintained)
        
        How to deal with legal king moves? Moving into check?
            -> foreach king move. avoid checkmask but is_square_attacked every other move?

        Pinned enpassant
            -> cannot enpassant if opponent piece is blocking check (pinned to king)
            -> special case, if both piece are blocking check together then cannot take 
        Castling
            -> cannot castle through or while in check
        
    */
    return true;
}

function advanced_move_gen() {
    let moves = generate_pseudo_moves();
    let res = [];
    for (let i = 0; i < moves.length; i++) {
        if (advanced_legal_move(moves[i])) {
            res.push(moves[i]);
        }
    }
    return res;
}

function smart_generate_pseudo_moves() {
    function generate_pawn_moves() {
    }
    function generate_knight_moves() {
    }
    function generate_bishop_moves() {
    }
    function generate_rook_moves() {
    }
    function generate_queen_moves() {
    }
    function generate_king_moves() {
    }
}

function generate_pseudo_moves2() {
    let moves = [];
    for (let i = 0; i < 6; i++) {
        let piece = 6 * TURN + i;
        let piece_board = copy_bitboard(BOARD[piece]);

        // Pawn moves
        if (i == 0) {
            while (bool_bitboard(piece_board)) {
                let source = pop_lsb_index(piece_board);
                let target = source + [-1, 1][TURN] * 8;

                // Push
                if (0 <= target && target < 64 && !get_bit(BOARD[14], target)) {
                    let trow = target >> 3;
                    if (trow == 0 || trow == 7) { // promotion
                        moves.push(create_move(source, target, piece, piece + 1)); // rook
                        moves.push(create_move(source, target, piece, piece + 2)); // knight
                        moves.push(create_move(source, target, piece, piece + 3)); // bishop
                        moves.push(create_move(source, target, piece, piece + 4)); // queen
                    } else {
                        // One square push
                        moves.push(create_move(source, target, piece));
                        // Two square push
                        let srow = source >> 3;
                        if (srow == [6, 1][TURN] && !get_bit(BOARD[14], target + [-1, 1][TURN] * 8)) {
                            moves.push(create_move(source, target + [-1, 1][TURN] * 8, piece, 0, 0, 1));
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
        }
        // Knight moves
        else if (i == 1) {
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
        }
        // Bishop moves
        else if (i == 2) {
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
        }
        // Rook moves
        else if (i == 3) {
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
        }
        // Queen moves
        else if (i == 4) {
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
        }
        // King moves
        else if (i == 5) {
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
                let king_pos = [60, 4][TURN];
                let king_side = [[61, 62], [5, 6]][TURN];
                let queen_side = [[59, 58, 57], [3, 2, 1]][TURN];
                if (!PLAYER_WHITE) {
                    king_pos--;
                    king_side[0] -= 3;
                    king_side[1] -= 5;
                    queen_side[0] += 1;
                    queen_side[1] += 3;
                    queen_side[2] += 5;
                }

                if ((!TURN && get_castle_pk(CASTLE)) || (TURN && get_castle_ak(CASTLE))) {
                    if (!get_bit(BOARD[14], king_side[0]) && !get_bit(BOARD[14], king_side[1])) {
                        if (!is_square_attacked(king_pos, TURN ^ 1) && !is_square_attacked(king_side[0], TURN ^ 1)) {
                            moves.push(create_move(king_pos, king_side[1], piece, 0, 0, 0, 0, 1));
                        }
                    }
                }
                if ((!TURN && get_castle_pq(CASTLE)) || (TURN && get_castle_aq(CASTLE))) {
                    if (!get_bit(BOARD[14], queen_side[0]) && !get_bit(BOARD[14], queen_side[1]) && !get_bit(BOARD[14], queen_side[2])) {
                        if (!is_square_attacked(king_pos, TURN ^ 1) && !is_square_attacked(queen_side[0], TURN ^ 1)) {
                            moves.push(create_move(king_pos, queen_side[1], piece, 0, 0, 0, 0, 1));
                        }
                    }
                }
            }
        }
    }
    return moves;
}

function generate_pseudo_moves() {
    let moves = [];
    // Pawn moves
    let piece = 6 * TURN;
    let piece_board = copy_bitboard(BOARD[piece]);
    while (bool_bitboard(piece_board)) {
        let source = pop_lsb_index(piece_board);
        let target = source + [-1, 1][TURN] * 8;

        // Push
        if (0 <= target && target < 64 && !get_bit(BOARD[14], target)) {
            let trow = target >> 3;
            if (trow == 0 || trow == 7) { // promotion
                moves.push(create_move(source, target, piece, piece + 1)); // rook
                moves.push(create_move(source, target, piece, piece + 2)); // knight
                moves.push(create_move(source, target, piece, piece + 3)); // bishop
                moves.push(create_move(source, target, piece, piece + 4)); // queen
            } else {
                // One square push
                moves.push(create_move(source, target, piece));
                // Two square push
                let srow = source >> 3;
                if (srow == [6, 1][TURN] && !get_bit(BOARD[14], target + [-1, 1][TURN] * 8)) {
                    moves.push(create_move(source, target + [-1, 1][TURN] * 8, piece, 0, 0, 1));
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
        let king_pos = [60, 4][TURN];
        let king_side = [[61, 62], [5, 6]][TURN];
        let queen_side = [[59, 58, 57], [3, 2, 1]][TURN];
        if (!PLAYER_WHITE) {
            king_pos--;
            king_side[0] -= 3;
            king_side[1] -= 5;
            queen_side[0] += 1;
            queen_side[1] += 3;
            queen_side[2] += 5;
        }

        if ((!TURN && get_castle_pk(CASTLE)) || (TURN && get_castle_ak(CASTLE))) {
            if (!get_bit(BOARD[14], king_side[0]) && !get_bit(BOARD[14], king_side[1])) {
                if (!is_square_attacked(king_pos, TURN ^ 1) && !is_square_attacked(king_side[0], TURN ^ 1)) {
                    moves.push(create_move(king_pos, king_side[1], piece, 0, 0, 0, 0, 1));
                }
            }
        }
        if ((!TURN && get_castle_pq(CASTLE)) || (TURN && get_castle_aq(CASTLE))) {
            if (!get_bit(BOARD[14], queen_side[0]) && !get_bit(BOARD[14], queen_side[1]) && !get_bit(BOARD[14], queen_side[2])) {
                if (!is_square_attacked(king_pos, TURN ^ 1) && !is_square_attacked(queen_side[0], TURN ^ 1)) {
                    moves.push(create_move(king_pos, queen_side[1], piece, 0, 0, 0, 0, 1));
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
        if (PLAYER_WHITE) {
            message = "Checkmate. " + (TURN ? "White" : "Black") + " wins";
        } else {
            message = "Checkmate. " + (TURN ? "Black" : "White") + " wins";
        }
    }
    setTimeout(() => { alert(message); }, 250);
    // TURN = 2; // prevent moving pieces
}

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
    let value = { "P": 0, "N": 1, "B": 2, "R": 3, "Q": 4, "K": 5 };
    if (input.length != 2 || !Object.keys(value).includes(input[1]) || !"WB".includes(input[0])) { return; }

    promote_piece = (input[0] == "W" ? 0 : 6) + value[input[1]];
    console.log(promote_piece);
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
        ["8/1p4p1/5p1p/1k3P2/6PP/3KP3/8/8 w - - 0 50", "White"] // K+P
        ["8/8/1p1k4/5ppp/PPK1p3/6P1/5PP1/8 b - - 0 0", "Black"] // K+P
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
    start_game(PLAYER_WHITE, fen);
}

function undo_move() {
    GAME.pop();
    GAME.pop();
    BOARD = GAME[GAME.length - 1];
    if (!BOARD) { return start_game(PLAYER_WHITE); }
    GAME.pop(); // pushed back on in display_board

    GAME_MOVES.pop();
    GAME_MOVES.pop();
    GAME_HASH.pop();
    GAME_HASH.pop();

    display_board();
    doHumanMove();
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
    open("https://www.chess.com/analysis?pgn=" + get_game_moves().replaceAll(" ", "%20"));
}
function open_lichess() {
    open("https://www.lichess.org/analysis/pgn/" + get_game_moves().replaceAll(" ", "_"));
}

function get_pgn() {
    let res = '[Event "?"]\n[Site "?"]\n[Date "????.??.??"]\n[Round "?"]\n[White "?"]\n[Black "?"]\n[Result "*"]\n\n' + get_game_moves() + "*";
    copy_to_clipboard(res);
    return res;
}

function get_fen() {
    let values; let castle; let en_pass;
    let start; let direction;
    if (PLAYER_WHITE) {
        values = "PNBRQKpnbrqk";
        castle = (get_castle_pk(CASTLE) ? "K" : "") + (get_castle_pq(CASTLE) ? "Q" : "") + (get_castle_ak(CASTLE) ? "k" : "") + (get_castle_aq(CASTLE) ? "q" : "");
        if (EN_PASSANT_SQUARE) {
            en_pass = String.fromCharCode(97 + EN_PASSANT_SQUARE % 8) + (((64 - EN_PASSANT_SQUARE) >> 3) + 1);
        } else {
            en_pass = "-";
        }
        start = 0; direction = 1;
    } else {
        values = "pnbrqkPNBRQK";
        castle = (get_castle_pk(CASTLE) ? "k" : "") + (get_castle_pq(CASTLE) ? "q" : "") + (get_castle_ak(CASTLE) ? "K" : "") + (get_castle_aq(CASTLE) ? "Q" : "");
        if (EN_PASSANT_SQUARE) {
            en_pass = String.fromCharCode(97 + 7 - EN_PASSANT_SQUARE % 8) + ((EN_PASSANT_SQUARE >> 3) + 1);
        } else {
            en_pass = "-";
        }
        start = 7; direction = -1;
    }
    if (!castle.length) { castle = "-"; }
    let res = ""; let count = 0;
    let i = start;
    while (0 <= i && i <= 7) {
        let j = start;
        while (0 <= j && j <= 7) {
            let p = 8 * i + j;
            if (get_bit(BOARD[14], p)) {
                if (count) {
                    res += (count);
                }
                count = 0;
                for (let k = 0; k < 12; k++) {
                    if (get_bit(BOARD[k], p)) {
                        res += values[k];
                    }
                }
            } else {
                count++;
            }
            j += direction;
        }
        if (count) {
            res += (count);
        }
        count = 0;
        res += "/";

        i += direction;
    }

    res = res.slice(0, res.length - 1) + " " + (PLAYER_WHITE ^ TURN ? "w" : "b") + " " + castle + " " + en_pass + " 0 1";
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

function flip_fen(fen) {
    let res = "";
    let i = 0;
    while (i < fen.length) {
        let row = "";
        while (i < fen.length && fen[i] != "/" && fen[i] != " ") {
            row += fen[i];
            i++;
        }
        let rev_row = "";
        for (let j = row.length - 1; j >= 0; j--) {
            rev_row += row[j];
        }
        res = rev_row + res;
        if (fen[i] == " ") {
            res += " " + fen[i + 1] + " ";
            if (fen[i + 3] != "-") {
                while (fen[i + 3] != " ") {
                    res += fen[i + 3];
                    i++;
                }
            } else { res += "-"; }
            res += " ";
            if (fen[i + 4] != "-") {
                let letters = {"a": "h", "b": "g", "c": "f", "d": "e", "f": "c", "g": "b", "h": "a"};
                res += letters[fen[i + 4]];
                let new_num = 9 - parseInt(fen[i + 5]);
                res += new_num.toString();
            } else { res += "-"; }
            res += " " + fen[fen.length - 3] + " " + fen[fen.length - 1];
            return res;
        } else {
            res = fen[i] + res;
        }
        i++;
    } 
    return res;
}

function make_table(player_white) {
    let table = '<table id="chess-table" class="chess-board">';
    let row_order = player_white ? "87654321" : "12345678";
    let col_order = player_white ? "abcdefgh" : "hgfedcba";
    for (let row = 0; row < 8; row++) {
        table += '<tr>';
        for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 == 1) {
                colour_class = 'dark';    
            } else {
                colour_class = 'light';
            }
            table += '<td id="s' + (8 * row + col) + '" class="' + colour_class + '" style="position: relative;">';
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
    function asList(array) {
        let res = [];
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                res.push(array[i][j]);
            }
        }
        return res;
    }
    let values;
    if (PLAYER_WHITE) {
        values = {
            P: 1,
            N: 2,
            B: 3,
            R: 4,
            Q: 5,
            K: 6,
    
            p: 7,
            n: 8,
            b: 9,
            r: 10,
            q: 11,
            k: 12,                   
        }
    } else {
        values = {
            P: 7,
            N: 8,
            B: 9,
            R: 10,
            Q: 11,
            K: 12,
    
            p: 1,
            n: 2,
            b: 3,
            r: 4,
            q: 5,
            k: 6,                   
        }
        fen = flip_fen(fen);
    }

    let res = new Array(8);
    for (let i = 0; i < 8; i++) {
        res[i] = new Array(8).fill(0);
    }

    let curr_row = 0;
    let curr_col = 0;

    for (let i = 0; i < fen.length; i++) {
        let char = fen[i];
        if (char == " ") {
            let castle = [0, 0, 0, 0];
            let j = 3;
            while (fen[i + j] != " ") {
                if (fen[i + j] == "K") {
                    castle[0] = 1;
                } else if (fen[i + j] == "Q") {
                    castle[1] = 1;
                } else if (fen[i + j] == "k") {
                    castle[2] = 1;
                } else if (fen[i + j] == "q") {
                    castle[3] = 1;
                }
                j++;
            }
            if (fen[i + j + 1] != "-") {
                EN_PASSANT_SQUARE = 8 * (8 - parseInt(fen[i + j + 2])) + fen[i + j + 1].charCodeAt() - 97;
                if (!PLAYER_WHITE) {
                    EN_PASSANT_SQUARE = 63 - EN_PASSANT_SQUARE;
                }
            }

            TURN = fen[i + 1] == "w" ? 0 : 1;

            if (!PLAYER_WHITE) {
                TURN ^= 1;
                let temp = castle[0];
                castle[0] = castle[2];
                castle[2] = temp;
                temp = castle[1];
                castle[1] = castle[3];
                castle[3] = temp;
            }
            CASTLE = create_castle(castle);
            return create_board(asList(res));

        } else if (char == "/") {
            curr_row++;
            curr_col = 0;
        } else if (!isNaN(char)) {
            curr_col += parseInt(char);
        } else {
            res[curr_row][curr_col] = values[char];
            curr_col++;
        }
    }
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
        piece_location.style.background = (piece_location.className == "light") ? "#f1d9c0" : "#a97a65";
        piece_location.innerHTML = remove_img_div(piece_location.innerHTML);
        
        if (get_bit(BOARD[14], i)) {
            for (let j = 0; j < 12; j++) {
                if (get_bit(BOARD[j], i)) {
                    let piece_number = (j + 6 * !PLAYER_WHITE) % 12;
                    let piece = '<img draggable="false" style="width: ' + (width - 10) + 'px; height: ' + (width - 10) + 'px;" src="../chess_piece_images/' + (piece_number) + '.png">';
                    piece_location.innerHTML += '<div id="' + (i) + '" class="chess-piece">' + piece + '</div>';
                    pieceDrag(document.getElementById((i)), i, false);
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

    let s_location = table.rows.item(move_source >> 3).cells.item(move_source % 8);
    let t_location = table.rows.item(move_target >> 3).cells.item(move_target % 8);

    s_location.style.background = (s_location.className == "light") ? lcode : dcode;
    t_location.style.background = (t_location.className == "light") ? lcode : dcode;
}

function doAiMove(differentAi=false) {
    let res;
    if (differentAi) { res = basicSearch(4); } 
    else { res = search(LOOKAHEAD); }
    let evaluation = res[0]; let time = res[1]; let moves = res[2];
    let best_move = pv_table[0][0];

    if (!do_move(best_move)) {
        finish();
        return false;
    }

    let md = get_move_desc(best_move, moves);
    GAME.push(copy_board(BOARD));
    GAME_MOVES.push(md);
    GAME_HASH.push(hash_key);

    evaluation = Math.round(evaluation + Number.EPSILON);
    if (evaluation < -99900) {
        if (evaluation == -99999) { setTimeout(() => {  return finish(); }, 250); }
        evaluation = "-M" + ((99999 + evaluation) / 2 << 0);
    } else if (evaluation > 99900) {
        if (evaluation == 99999) { setTimeout(() => {  return finish(); }, 250); }
        evaluation = "M" + ((99999 - evaluation + 1) / 2 << 0);
    } else { evaluation /= 100; }
    if (time == 0) { evaluation = "Book"; }

    // Print search details
    // document.getElementById("move_number").innerHTML = "Move number: " + (get_move_number() + PLAYER_WHITE);
    // document.getElementById("analysed").value = (COUNT);
    // document.getElementById("depth_input").value = (LOOKAHEAD);
    // document.getElementById("time").value = (time) + " ms";
    // document.getElementById("move").value = md;
    // document.getElementById("evaluation").value = evaluation;

    if (!DISABLE_LOOKAHEAD && !differentAi) {
        if (!time) {
            // book move
        } else if (time < 750) { // under 0.5s, INCREASE
            LOOKAHEAD_COUNT = 2;
        } else if (time < 1500) {
            LOOKAHEAD_COUNT++;
        } else if (time > 15000) { // over 15s, DECREASE
            LOOKAHEAD_COUNT = -2;
        } else if (time > 7500) {
            LOOKAHEAD_COUNT--;
        }

        if (LOOKAHEAD_COUNT >= 2) { // 2 fast moves
            LOOKAHEAD++;
            LOOKAHEAD_COUNT = 0;
        } else if (LOOKAHEAD_COUNT <= -2) { // 2 slow moves
            LOOKAHEAD--;
            LOOKAHEAD_COUNT = 0
        }
    }
    display_board();
    highlightLastMove(best_move);

    return true;
}

function doHumanMove() {
    for (let i = 0; i < 64; i++) {
        if (get_bit(BOARD[14], i)) {
            for (let j = 0; j < 12; j++) {
                if (get_bit(BOARD[j], i)) {
                    let piece_number = (j + 6 * !PLAYER_WHITE) % 12;
                    let piece_white = piece_number < 6;
                    pieceDrag(document.getElementById((i)), i, !(piece_white ^ PLAYER_WHITE));
                    break;
                }
            }
        }
    }
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
                piece_location.style.background = (piece_location.className == "light") ? "#f1d9c0" : "#a97a65";
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
        let col_diff = Math.round(div.offsetLeft / width)
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
            if (!PLAYER_WHITE) {
                TURN ^= 1;
            }
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

    function doLegalMove(target) {
        let res = legal_move(pos, target);
        let moves = res[0]; let move = res[1];
        if (move && advanced_legal_move(move)) {
            if (get_move_promote(move)) { // ask for promote input
                move |= 983040; // set promote 15
            }
            if (do_move(move)) {
                GAME.push(copy_board(BOARD));
                GAME_MOVES.push(get_move_desc(move, moves));
                GAME_HASH.push(hash_key);

                let message = "LOADING";
                let res = "<div>";
                for (let i = 0; i < message.length; i++) {
                    res += message[i] + "<br></br>";
                }
                res += "</div>";
                document.getElementById("loading").innerHTML = res;
                
                setTimeout(() => {  

                    if (loading) {
                        loading.innerHTML = "";
                    }
                    display_board(move); 
                    doAiMove();
                    doHumanMove();

                }, 250);
                return true;
            }
            let king_pos = TURN ? lsb_index(BOARD[11]) : lsb_index(BOARD[5]);
            let king_location = document.getElementById("chess-table").rows.item(king_pos >> 3).cells.item(king_pos % 8);
            king_location.style.background = "#FF0000"; // RED
            setTimeout(() => {
                king_location.style.background = (king_location.className == "light") ? "#f1d9c0" : "#a97a65";
            }, 250);
        }
        return false;
    }
}

function upload_game() {
    let fen = prompt("Enter fen:");
    if (fen && fen.length < 19) { 
        fen = START_FEN; 
    }
    start_game(true, fen);
}

function prepare_game(whiteDown, fen=START_FEN, startLookahead=6) {
    DISABLE_LOOKAHEAD = false;
    GAME = [];
    GAME_HASH = [];
    GAME_MOVES = [];

    PLAYER_WHITE = whiteDown;
    LOOKAHEAD = startLookahead;

    make_table(whiteDown);
    BOARD = make_board(fen);
    hash_key = init_hash();

    display_board();
    initialise_ai_constants();
}

async function start_game(whiteDown, fen=START_FEN, startLookahead=6) {
    let stored_fen = document.getElementById("stored_fen").value;
    if (fen == START_FEN && stored_fen) { fen = stored_fen; }
    if (!fen) { fen = START_FEN; } 
    document.getElementById("stored_fen").value = fen;

    prepare_game(whiteDown, fen, startLookahead);

    if (fen == "6k1/8/8/8/8/8/8/4BNK1 w - - 0 0") {
        GAME_MOVES = ["e4","e5","Qh5","Qh4","Qxh7","Qxh2","Qxh8","Qxh1","Qxg8","Qxg1","Qxg7","Qxg2","Qxf7+","Kd8","Qd5","Qxf2+","Kd1","Ke8","Qxb7","Kf7","Bg2","Qxg2","Qxa8","Kg8","Qxb8","Qxe4","Qxc8","Qxc2+","Ke1","Qxd2+","Kf1","Qxb2","Kg1","Qxa1","Qxc7","Qxa2","Qxe5","Bd6","Qxd6","Qf7","Qxd7","Qh7","Qxa7","Qf7","Qxf7+","Kxf7","Bd2","Kg8","Be1","Kf7","Nd2","Kf8","Nf1","Kg8"];
    }

    if (TURN) {
        doAiMove();
    }
    doHumanMove();
}

let START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

let PAWN_ATTACK;
let KNIGHT_ATTACK;
let KING_ATTACK;

let PLAYER_WHITE;
let TURN; // 0 for player, 1 for ai
let CASTLE = create_castle();
let EN_PASSANT_SQUARE; // pawn moves 2 spots, record position behind pawn

let LOOKAHEAD_COUNT = 0;
let LOOKAHEAD;

let opening_phase = 6192;
let endgame_phase = 518;

let BOARD;
let GAME; // for easy undo move
let GAME_HASH;
let GAME_MOVES;

initialiseConstants();
initialise_ai_constants();

start_game(true);