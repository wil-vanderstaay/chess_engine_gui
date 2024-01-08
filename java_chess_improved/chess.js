// FUNCTIONS ----------------------------------------------------------------------------------------------------------------------
//#region
function square_index(name) { return name[0].charCodeAt() - (parseInt(name[1]) << 3) - 33; }
function square_name(index) { return String.fromCharCode((index & 7) + 97) + (8 - (index >> 3)) }
//#endregion

// BITBOARDS ----------------------------------------------------------------------------------------------------------------------
//#region
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

function get_bit(bitboard, i) { return (bitboard[+(i >= 32)] & (1 << (i & 31))) ? 1 : 0; }
function set_bit(bitboard, i) { bitboard[+(i >= 32)] |= (1 << (i & 31)); }
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
//#endregion

// MOVE ----------------------------------------------------------------------------------------------------------------------
//#region
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
function create_move_uci(uci, board) {
    let source = square_index(uci[0] + uci[1]);
    let target = square_index(uci[2] + uci[3]);
    let piece = 0;
    for (let i = 0; i < 12; i++) {
        if (get_bit(board.bitboards[i], source)) {
            piece = i;
            break;
        }
    }
    let letters = " nbrq";
    let promote = 0;
    if (uci.length == 5) { promote = letters.indexOf(uci[4]) + 6 * board.turn; }
    let double = !(piece % 6) && Math.abs((source >> 3) - (target >> 3)) == 2;
    let enpassant = !(piece % 6) && Math.abs((source & 7) - (target & 7)) == 1 && !get_bit(board.bitboards[14], target);
    let capture = (enpassant || get_bit(board.bitboards[14], target)) ? 1 : 0;
    let castle = piece % 6 == 5 && Math.abs((source & 7) - (target & 7)) == 2;
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
//#endregion

// BOT ----------------------------------------------------------------------------------------------------------------------
class Bot {
    constructor() {

    }

    think(board) {
        let moves = board.generate_moves();
        return moves[0];
    }
}

// BOARD ----------------------------------------------------------------------------------------------------------------------
function pawn_attack() {
    let res = [new Array(64), new Array(64)];
    for (let i = 0; i < 64; i++) { // player
        let col = i & 7;

        let player = [0, 0];           
        if (8 < i && 0 < col) { set_bit(player, i - 9); }
        if (6 < i && col < 7) { set_bit(player, i - 7); }
        res[0][i] = player;

        let ai = [0, 0]
        if (i < 57 && 0 < col) { set_bit(ai, i + 7); }
        if (i < 55 && col < 7) { set_bit(ai, i + 9); }
        res[1][i] = ai;
    }

    return res;
}
function knight_attack() {
    let res = new Array(64);
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let i = (r << 3) + c;
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

class Board {
     CASTLING_RIGHTS = [
        7, 15, 15, 15,  3, 15, 15, 11,
        15, 15, 15, 15, 15, 15, 15, 15,
        15, 15, 15, 15, 15, 15, 15, 15,
        15, 15, 15, 15, 15, 15, 15, 15,
        15, 15, 15, 15, 15, 15, 15, 15, 
        15, 15, 15, 15, 15, 15, 15, 15,
        15, 15, 15, 15, 15, 15, 15, 15,
        13, 15, 15, 15, 12, 15, 15, 14
    ];

    // Generate move constants
    NUM_SQUARES_EDGE = squares_to_edge(); // [square][dir] (0 N, 1 E, 2 S, 3 W, 4 NE, 5 SE, 6 SW, 7 NW)
    DIR_OFFSETS = [-8, 1, 8, -1, -7, 9, 7, -9]; // [dir]
    PAWN_ATTACK = pawn_attack(); // [side][square]
    KNIGHT_ATTACK = knight_attack(); // [square]
    KING_ATTACK = king_attack(); // [square]

    constructor(fen) {
        /*
            this.bitboards - 15 bitboards - 6 white, 6 black, 3 occupancy
            this.turn
            this.castle
            this.enpassant
            this.fifty
        */

        // BITBOARDS 
        let board = new Array(64).fill(0);
        let split_fen = fen.split(" ");
        let row = 0, col = 0;
        let pieces = "PNBRQKpnbrqk";
        for (let i = 0; i < split_fen[0].length; i++) {
            let char = fen[i];
            if (char == "/") { row++; col = 0; } 
            else if (!isNaN(char)) { col += parseInt(char); } 
            else { board[(row << 3) + col] = pieces.indexOf(char) + 1; col++; }
        }
        this.bitboards = new Array(15);
        for (let i = 0; i < this.bitboards.length; i++) { this.bitboards[i] = [0, 0]; }
        for (let i = 0; i < 64; i++) { // pieces
            let piece = board[i];
            if (piece) { set_bit(this.bitboards[piece - 1], i); }
        }
        for (let i = 0; i < 6; i++) { // white, black
            this.bitboards[12] = or_bitboards(this.bitboards[12], this.bitboards[i]);
            this.bitboards[13] = or_bitboards(this.bitboards[13], this.bitboards[i + 6]);
        }
        this.bitboards[14] = or_bitboards(this.bitboards[12], this.bitboards[13]); // board

        // this.turn
        this.turn = split_fen[1] == "w" ? 0 : 1;
        
        // CASTLE
        this.castle = 0;
        if (split_fen[2] != "-") {
            let lookup = "KQkq";
            for (let i = 0; i < split_fen[2].length; i++) { this.castle |= 1 << lookup.indexOf(split_fen[2][i]); }
        }

        // ENPASSANT
        this.enpassant = 0;
        if (split_fen[3] != "-") { 
            this.enpassant = square_index(split_fen[3]);
        }

        // FIFTY
        this.fifty = parseInt(split_fen[4]);
    }

    is_square_attacked(square, side) {
        let att_piece = side * 6;
        // Attacked by knights
        if (bool_bitboard(and_bitboards(this.KNIGHT_ATTACK[square], this.bitboards[att_piece + 1]))) { return 2; }
        // Attacked by bishops
        if (bool_bitboard(and_bitboards(bishop_attack_fly(square, this.bitboards[14]), this.bitboards[att_piece + 2]))) { return 3; }
        // Attacked by rooks
        if (bool_bitboard(and_bitboards(rook_attack_fly(square, this.bitboards[14]), this.bitboards[att_piece + 3]))) { return 4; }
        // Attacked by queens
        if (bool_bitboard(and_bitboards(queen_attack_fly(square, this.bitboards[14]), this.bitboards[att_piece + 4]))) { return 5; }
        // Attacked by pawns
        if (bool_bitboard(and_bitboards(this.PAWN_ATTACK[side ^ 1][square], this.bitboards[att_piece]))) { return 1; }
        // Attacked by kings
        if (bool_bitboard(and_bitboards(this.KING_ATTACK[square], this.bitboards[att_piece + 5]))) { return 6; }
        
        return 0;
    }

    sliding_moves(square, blocker, start_dir_index, end_dir_index) {
        let res = [0, 0];
        for (; start_dir_index < end_dir_index; start_dir_index++) {
            let offset = this.DIR_OFFSETS[start_dir_index];
            let edge = this.NUM_SQUARES_EDGE[square][start_dir_index];
            for (let i = 0; i < edge; i++) {
                let target = square + offset * (i + 1);
                set_bit(res, target);
                if (get_bit(blocker, target)) { break; }
            }
        }
        return res;
    }


    generate_moves() {
        return this.generate_pseudo_moves();
    }

    generate_pseudo_moves() {
        let moves = [];
        // Pawn moves
        let piece = 6 * this.turn;
        let piece_board = copy_bitboard(this.bitboards[piece]);
        let pawn_direction = this.turn ? 8 : -8;
    
        let curr_occ = 12 + this.turn;
        let opp_occ = 12 + (this.turn ^ 1);
    
        while (bool_bitboard(piece_board)) {
            let source = pop_lsb_index(piece_board);
            let target = source + pawn_direction;
    
            let promote = target < 8 || target >= 56;
            let double = source < 16 || source >= 48;
    
            // Push
            if (!get_bit(this.bitboards[14], target)) {
                if (promote) { // promotion
                    moves.push(create_move(source, target, piece, piece + 1)); // knight
                    moves.push(create_move(source, target, piece, piece + 2)); // bishop
                    moves.push(create_move(source, target, piece, piece + 3)); // rook
                    moves.push(create_move(source, target, piece, piece + 4)); // queen
                } else {
                    // One square push
                    moves.push(create_move(source, target, piece));
                    // Two square push
                    if (double && !get_bit(this.bitboards[14], target + pawn_direction)) {
                        moves.push(create_move(source, target + pawn_direction, piece, 0, 0, 1));
                    }
                }
            }
    
            // Capture
            let attacks = and_bitboards(this.PAWN_ATTACK[this.turn][source], this.bitboards[opp_occ]);
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
            // En passant
            if (this.enpassant && get_bit(this.PAWN_ATTACK[this.turn][source], this.enpassant)) {
                    moves.push(create_move(source, this.enpassant, piece, 0, 1, 0, 1));
            }
        }
        // Knight moves
        piece++;
        piece_board = copy_bitboard(this.bitboards[piece]);
        while(bool_bitboard(piece_board)) {
            let source = pop_lsb_index(piece_board);
            let attacks = nand_bitboards(this.KNIGHT_ATTACK[source], this.bitboards[curr_occ]);
            while (bool_bitboard(attacks)) {
                let att = pop_lsb_index(attacks);
                moves.push(create_move(source, att, piece, 0, get_bit(this.bitboards[opp_occ], att)));
            }
        }
        // Bishop moves
        piece++;
        piece_board = copy_bitboard(this.bitboards[piece]);
        while(bool_bitboard(piece_board)) {
            let source = pop_lsb_index(piece_board);
            let attacks = nand_bitboards(this.sliding_moves(source, this.bitboards[14], 4, 8), this.bitboards[curr_occ]);
            while (bool_bitboard(attacks)) {
                let att = pop_lsb_index(attacks);
                moves.push(create_move(source, att, piece, 0, get_bit(this.bitboards[opp_occ], att)));
            }
        }
        // Rook moves
        piece++;
        piece_board = copy_bitboard(this.bitboards[piece]);
        while(bool_bitboard(piece_board)) {
            let source = pop_lsb_index(piece_board);
            let attacks = nand_bitboards(this.sliding_moves(source, this.bitboards[14], 0, 4), this.bitboards[curr_occ]);
            while (bool_bitboard(attacks)) {
                let att = pop_lsb_index(attacks);
                moves.push(create_move(source, att, piece, 0, get_bit(this.bitboards[opp_occ], att)));
            }
        }
        // Queen moves
        piece++;
        piece_board = copy_bitboard(this.bitboards[piece]);
        while(bool_bitboard(piece_board)) {
            let source = pop_lsb_index(piece_board);
            let attacks = nand_bitboards(this.sliding_moves(source, this.bitboards[14], 0, 8), this.bitboards[curr_occ]);
            while (bool_bitboard(attacks)) {
                let att = pop_lsb_index(attacks);
                moves.push(create_move(source, att, piece, 0, get_bit(this.bitboards[opp_occ], att)));
            }
        }
        // King moves
        piece++;
        piece_board = copy_bitboard(this.bitboards[piece]);
        // Normal moves
        let source = lsb_index(piece_board);
        let attacks = nand_bitboards(this.KING_ATTACK[source], this.bitboards[curr_occ]);
        while (bool_bitboard(attacks)) {
            let att = pop_lsb_index(attacks);
            moves.push(create_move(source, att, piece, 0, get_bit(this.bitboards[opp_occ], att)));
        }

        // Castling
        if (this.castle) {
            let king_pos = this.turn ? 4 : 60;
            if ((this.turn ? this.castle & 4 : this.castle & 1) && !get_bit(this.bitboards[14], king_pos + 1) && !get_bit(this.bitboards[14], king_pos + 2) && !this.is_square_attacked(king_pos, this.turn ^ 1) && !this.is_square_attacked(king_pos + 1, this.turn ^ 1)) {
                moves.push(create_move(king_pos, king_pos + 2, piece, 0, 0, 0, 0, 1));
            }
            if ((this.turn ? this.castle & 8 : this.castle & 2) && !get_bit(this.bitboards[14], king_pos - 1) && !get_bit(this.bitboards[14], king_pos - 2) && !get_bit(this.bitboards[14], king_pos - 3) && !this.is_square_attacked(king_pos, this.turn ^ 1) && !this.is_square_attacked(king_pos - 1, this.turn ^ 1)) {
                moves.push(create_move(king_pos, king_pos - 2, piece, 0, 0, 0, 0, 1));
            }
        }
        return moves;
    }
    

    get_legal_move(source, target) {
        let moves = this.generate_moves();
        for (let i = 0; i < 64; i++) {
            let move = moves[i];
            if (get_move_source(move) == source && get_move_target(move) == target) {
                return move;
            }
        }
        return 0;
    }

    do_move(move) {
        if (!move) { return false; }
    
        let source = get_move_source(move);
        let target = get_move_target(move);
        let piece = get_move_piece(move);
    
        let opp_colour = this.turn ^ 1;
        let opp_start = opp_colour * 6;
    
        let curr_occ = 12 + this.turn;
        let opp_occ = 12 + opp_colour;
    
        // Remove captured piece
        if (get_move_capture(move)) {
            for (let i = opp_start; i < opp_start + 6; i++) {     
                if (get_bit(this.bitboards[i], target)) {
                    pop_bit(this.bitboards[i], target);
                    pop_bit(this.bitboards[opp_occ], target);
                    pop_bit(this.bitboards[14], target);
                    break;
                }
            }
        }

        // Move piece
        pop_bit(this.bitboards[piece], source);
        pop_bit(this.bitboards[curr_occ], source);
        pop_bit(this.bitboards[14], source);
        set_bit(this.bitboards[piece], target);
        set_bit(this.bitboards[curr_occ], target);
        set_bit(this.bitboards[14], target);
    
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
            pop_bit(this.bitboards[piece], target);
            set_bit(this.bitboards[promote_piece], target);
        }
        // Perform enpassant
        else if (get_move_enpassant(move)) {
            let s = target + 8 - (this.turn << 4);
            pop_bit(this.bitboards[opp_start], s);
            pop_bit(this.bitboards[opp_occ], s);
            pop_bit(this.bitboards[14], s);
        }
        // Perform castle 
        else if (get_move_castle(move)) {
            let kingside = (target == 62) || (target == 6); 
            let rook_source = (kingside) ? target + 1 : target - 2;
            let rook_target = (kingside) ? target - 1 : target + 1;
    
            pop_bit(this.bitboards[piece - 2], rook_source);
            pop_bit(this.bitboards[curr_occ], rook_source);
            pop_bit(this.bitboards[14], rook_source);
            set_bit(this.bitboards[piece - 2], rook_target);
            set_bit(this.bitboards[curr_occ], rook_target);
            set_bit(this.bitboards[14], rook_target);
        } 
        
        // Set enpassant
        this.enpassant = get_move_double(move) ? target + 8 - (this.turn << 4) : 0;
    
        // Update castle
        this.castle &= this.CASTLING_RIGHTS[source];
        this.castle &= this.CASTLING_RIGHTS[target];
    
        // Moving into check, reset state
        // TODO

        this.turn ^= 1;
        return true;
    }

    print_board() {
        let letters = "PNBRQKpnbrqk";
        let res = "";
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                let k = (i << 3) + j;
                if (get_bit(this.bitboards[14], k)) {
                    for (let p = 0; p < 12; p++) {
                        if (get_bit(this.bitboards[p], k)) {
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
}

// GAME ----------------------------------------------------------------------------------------------------------------------
class Game {
    START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    constructor(playerWhite, fen=this.START_FEN) {
        this.playerWhite = playerWhite;
        this.board = new Board(fen);
        this.bot = new Bot();
        this.moves = [];
        this.make_table();
        this.display();

        if (!this.playerWhite) { 
            this.do_ai_move();
        }
    }

    make_table() {
        let table = '<table id="chess-table" class="chess-board">';
        let row_order = this.playerWhite ? "87654321" : "12345678";
        let col_order = this.playerWhite ? "abcdefgh" : "hgfedcba";
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

    do_player_move(source, target) {
        if (!this.playerWhite) {
            source = 63 - source;
            target = 63 - target;
        }
        let move = this.board.get_legal_move(source, target);
        if (move) {
            document.getElementById("s" + (source)).className += " highlight";
            document.getElementById("s" + (target)).className += " highlight";
            if (get_move_promote(move)) { // ask for promote input
                move |= 983040; // set promote 15
            }
            this.board.do_move(move);
            this.moves.push(move);
            this.display(true);
            this.do_ai_move();
            return true;
        }
        return false;
    }

    do_ai_move() {
        let move = this.bot.think(this.board);
        this.board.do_move(move);
        this.moves.push(move);
        this.display();
    }

    display() {
        function piece_drag(game_inst, div, pos, moveable, legal_moves) {
            let row = pos >> 3;
            let col = pos & 7;

            let pos1 = 0; let pos2 = 0; let pos3 = 0; let pos4 = 0;
            let top_offset = 3; 
            let left_offset = 4; 
            div.style.top = (top_offset) + "px";
            div.style.left = (left_offset) + "px";

            if (moveable) { div.onmousedown = open_drag_element; }

            for (let i = 0; i < 64; i++) {
                if (!last_move || (i != last_move_source && i != last_move_target)) {
                    let d = document.getElementById("s" + (i));
                    d.className = d.className.replaceAll(" highlight", "");
                    d.onclick = null;
                }
            }

            function open_drag_element(e) {
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = close_drag_element;
                document.onmousemove = drag_element;
                drag_element(e);
            }
            
            function close_drag_element(e) {
                document.onmouseup = null;
                document.onmousemove = null;
        
                let row_diff = Math.round(div.offsetTop / width);
                let col_diff = Math.round(div.offsetLeft / width);
                let new_pos = pos + (row_diff << 3) + col_diff;
                div.style.top = (width * row_diff + top_offset) + "px";
                div.style.left = (width * col_diff + left_offset) + "px";
                
                if (pos == new_pos) {
                    click_move_piece();
                } else {
                    if (!game_inst.do_player_move(pos, new_pos)) {
                        div.style.top = (top_offset) + "px";
                        div.style.left = (left_offset) + "px";
                        let d = document.getElementById("s" + (pos));
                        d.className = d.className.replaceAll(" highlight", "");
                        if (new_pos != last_move_source && new_pos != last_move_target) {
                            let d = document.getElementById("s" + (new_pos));
                            d.className = d.className.replaceAll(" highlight", "");
                        }
                    }
                }
            }

            function drag_element(e) {
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                div.style.top = (div.offsetTop - pos2) + "px";
                div.style.left = (div.offsetLeft - pos1) + "px";

                for (let i = 0; i < 64; i++) {
                    if (!last_move || (i != last_move_source && i != last_move_target)) {
                        let d = document.getElementById("s" + (i))
                        d.className = d.className.replaceAll(" highlight", "");
                    }
                }
                document.getElementById("s" + (pos)).className += " highlight";
                let r = row + Math.round(div.offsetTop / width);
                let c = col + Math.round(div.offsetLeft / width);
                if (0 <= r && r < 8 && 0 <= c && c < 8) {
                    let new_pos = (r << 3) + c;
                    document.getElementById("s" + (new_pos)).className += " highlight";
                }
            }

            function click_move_piece() {
                // set default onclick to reset highlighting
                for (let i = 0; i < 64; i++) {
                    document.getElementById("s" + (i)).onclick = () => {
                        for (let i = 0; i < 64; i++) {
                            let d = document.getElementById("s" + (i));
                            d.onclick = null;
                            if (!last_move || (i != last_move_source && i != last_move_target)) {
                            // if (i != pos && (!last_move || (i != last_move_source && i != last_move_target))) {
                                d.className = d.className.replaceAll(" highlight", "");
                            }
                        }
                    };
                }
                // override all pieces onclick
                let bitboard = copy_bitboard(game_inst.board.bitboards[14]);
                while (bool_bitboard(bitboard)) {
                    let i = pop_lsb_index(bitboard);
                    if (!game_inst.playerWhite) {
                        i = 63 - i;
                    }
                    document.getElementById("s" + (i)).onclick = null;
                }
                // override legal moves onclick
                for (let i = 0; i < legal_moves.length; i++) {
                    if (legal_moves[i][0] == pos) {
                        let new_pos = legal_moves[i][1];
                        document.getElementById("s" + (new_pos)).onclick = () => {
                            let row_diff = (new_pos >> 3) - (pos >> 3);
                            let col_diff = Math.round(div.offsetLeft / width);
                            div.style.top = (width * row_diff + top_offset) + "px";
                            div.style.left = (width * col_diff + left_offset) + "px";

                            game_inst.do_player_move(pos, new_pos);
                        }
                    }
                }
            }
        }

        let table = document.getElementById("chess-table");
        let s = document.getElementById("s0").getBoundingClientRect();
        let width = s.right - s.left;

        let last_move = this.moves[this.moves.length - 1];
        let last_move_source = get_move_source(last_move);
        let last_move_target = get_move_target(last_move);
        let legal_moves = this.board.generate_moves().map(move => [get_move_source(move), get_move_target(move)]);
        if (!this.playerWhite) {
            last_move_source = 63 - last_move_source;
            last_move_target = 63 - last_move_target;
            legal_moves = legal_moves.map(move => [63 - move[0], 63 - move[1]]); 
        }

        let bitboards = this.board.bitboards;
        for (let i = 0; i < 64; i++) {
            let piece_location = table.rows.item(i >> 3).cells.item(i & 7);
            if (piece_location.hasChildNodes()) { piece_location.removeChild(piece_location.childNodes[0]); }
            piece_location.style.background = "";

            let b = (this.playerWhite) ? i : 63 - i;
            if (get_bit(bitboards[14], b)) {
                for (let j = 0; j < 12; j++) {
                    if (get_bit(bitboards[j], b)) {
                        let piece = '<img draggable="false" style="width: ' + (width - 10) + 'px; height: ' + (width - 10) + 'px;" src="../imgs/chess_pieces/' + (j) + '.png">';
                        
                        let piece_div = document.createElement('div');
                        piece_div.id = i;
                        piece_div.className = "chess-piece";
                        piece_div.innerHTML = piece;
                        piece_location.appendChild(piece_div);

                        piece_drag(this, piece_div, i, (this.playerWhite ^ this.board.turn) && !((j < 6) ^ this.playerWhite), legal_moves);
                        break;
                    }
                }
            }
        }
        if (last_move) {
            document.getElementById("s" + (last_move_source)).className += " highlight";
            document.getElementById("s" + (last_move_target)).className += " highlight";
        }
    }

    print_board() {
        this.board.print_board();
    }
}

let game = new Game(false);