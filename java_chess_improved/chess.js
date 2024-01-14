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
    return [bitboard1[0] & ~bitboard2[0], bitboard1[1] & ~bitboard2[1]];
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
    if (bit) { 
        bitboard[+(i >= 32)] ^= (1 << (i & 31));
    }
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
            res += ["0 ", "1 "][get_bit(bitboard, (i << 3) + j)];
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
    let letters = ["", "n", "b", "r", "q"];
    let promote = get_move_promote(move) % 6;
    return square_name(get_move_source(move)) + square_name(get_move_target(move)) + letters[promote]; 
}
function get_move_san(move, board_inst, disambiguate=true) {
    if (!move) { return ""; }
    let uci = get_move_uci(move);

    let res = "";
    let letters = ["", "N", "B", "R", "Q", "K"];
    let source = get_move_source(move);
    let target = get_move_target(move);
    let piece = get_move_piece(move);
    let promote = get_move_promote(move);
    let capture = get_move_capture(move);

    if (get_move_castle(move)) { return ["O-O-O", "O-O"][+(source < target)]; }
    
    res += letters[piece % 6];
    if (!res && capture) { res += uci[0]; }

    if (disambiguate) {
        let disamb = [];
        let moves = board_inst.generate_moves();
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

// TIMER
class Timer {
    constructor(html_id, time, increment=0) {
        this.html = document.getElementById(html_id);
        this.timer = time;
        this.checkpoint = 0;
        this.increment = increment;

        this.update();
    }

    running() {
        return this.checkpoint != 0;
    }

    elapsed_this_turn() {
        return this.running() ? Math.round(performance.now() - this.checkpoint) : 0;
    }

    remaining() {
        return this.timer - this.elapsed_this_turn();
    }

    remaining_formatted() {
        let milli = this.remaining();
        if (milli <= 0) { milli = 0; }
        let seconds = Math.floor(milli / 1000) % 60;
        let minutes = Math.floor(milli / 1000 / 60);
        return minutes.toString() + ":" + seconds.toString().padStart(2, "0");
    }

    update() {
        this.html.innerHTML = this.remaining_formatted();
        let name = this.html.className;
        name = name.replaceAll(" highlight", "");
        name = name.replaceAll(" expired", "");
        if (this.remaining() <= 0) {
            name += " expired";
        } else if (this.running()) {
            name += " highlight";
        }
        this.html.className = name;
    }

    start() {
        this.checkpoint = Math.round(performance.now());
    }

    stop() {
        if (this.running()) { 
            this.timer = Math.round(this.timer - this.elapsed_this_turn());
            this.timer += this.increment * 1000; 
            this.checkpoint = 0;
        }
    }
}

// BOT ----------------------------------------------------------------------------------------------------------------------
class Bot {
    constructor() {}

    evaluate(board) {
        let res = 0;
        for (let i = 0; i < 6; i++) {
            res += count_bits(board.bitboards[i]);
            res -= count_bits(board.bitboards[i + 6]);
        }
        return [res, -res][board.turn];
    }

    score_move(board, move) {
        let res = 0;
        let target = get_move_target(move);
        let piece = get_move_piece(move) % 6;
    
        let att_piece = board.is_square_attacked(target, board.turn ^ 1);
        if (att_piece) {
            if (piece == 5) { return -150; } // moving into check
            if (piece > att_piece) { // attacked by lesser piece
                res += (-piece << 3) + att_piece;
            }
        }
    
        if (get_move_capture(move)) {
            let cap_piece = board.squares[target];
            if (!att_piece) { res += 20; } // free piece
            res += ((cap_piece - piece) << 2);
        }
        return res;
    }
    
    generate_ordered_moves(board) {
        return board.generate_moves().map(move => [score_move(board, move), move]).sort((a, b) => b[0] - a[0]).map(item => item[1]);
    }

    search(board, depth, alpha, beta) {
        if (depth == 0) { return this.evaluate(board); }
        let moves = this.generate_ordered_moves(board);
        for (let i = 0; i < moves.length; i++) {
            let move = moves[i];
    
            board.do_move(move);
            let score = -this.search(board, depth - 1, -beta, -alpha);
            board.undo_move(move);
            
            if (score > alpha) {
                alpha = score;
                if (score >= beta) { // oppenent response too strong, snip
                    return beta;
                } 
            }
        }
        return alpha;
    }

    think(board) {
        let moves = board.generate_moves();
        let n = Math.floor(Math.random() * moves.length);
        for (let i = 0; i < 200000000; i++) {
            n = Math.floor(Math.random() * moves.length);
        }
        return moves[n];
    }
}

// MOVE HELPER
class Move_Helper {
    static CASTLING_RIGHTS = [
        7, 15, 15, 15,  3, 15, 15, 11,
        15, 15, 15, 15, 15, 15, 15, 15,
        15, 15, 15, 15, 15, 15, 15, 15,
        15, 15, 15, 15, 15, 15, 15, 15,
        15, 15, 15, 15, 15, 15, 15, 15,
        15, 15, 15, 15, 15, 15, 15, 15,
        15, 15, 15, 15, 15, 15, 15, 15,
        13, 15, 15, 15, 12, 15, 15, 14
    ];
    static DIR_OFFSETS = [-8, 1, 8, -1, -7, 9, 7, -9]; // [dir] (0 N, 1 E, 2 S, 3 W, 4 NE, 5 SE, 6 SW, 7 NW)
    static NUM_SQUARES_EDGE = this.squares_to_edge(); // [square][dir]
    static PAWN_ATTACK = this.pawn_attack(); // [side][square]
    static KNIGHT_ATTACK = this.knight_attack(); // [square]
    static KING_ATTACK = this.king_attack(); // [square]

    static BISHOP_RELEVANT_BITS = [ // [square]
        6, 5, 5, 5, 5, 5, 5, 6,
        5, 5, 5, 5, 5, 5, 5, 5,
        5, 5, 7, 7, 7, 7, 5, 5,
        5, 5, 7, 9, 9, 7, 5, 5,
        5, 5, 7, 9, 9, 7, 5, 5,
        5, 5, 7, 7, 7, 7, 5, 5,
        5, 5, 5, 5, 5, 5, 5, 5,
        6, 5, 5, 5, 5, 5, 5, 6
    ];
    static ROOK_RELEVANT_BITS = [ // [square]
        12, 11, 11, 11, 11, 11, 11, 12,
        11, 10, 10, 10, 10, 10, 10, 11,
        11, 10, 10, 10, 10, 10, 10, 11,
        11, 10, 10, 10, 10, 10, 10, 11,
        11, 10, 10, 10, 10, 10, 10, 11,
        11, 10, 10, 10, 10, 10, 10, 11,
        11, 10, 10, 10, 10, 10, 10, 11,
        12, 11, 11, 11, 11, 11, 11, 12
    ]; 
    static BISHOP_MAGICS = [ // [square]
        [2155905152, 4198400],
        [33587200, 262408],
        [8388608, 524420],
        [2147483648, 263168],
        [0, 69696],
        [1073741824, 34820],
        [538968064, 16898],
        [67175424, 131204],
        [268501504, 4098],
        [67371072, 516],
        [2155937792, 4096],
        [8388608, 1028],
        [536870912, 1028],
        [272629760, 130],
        [17827840, 264],
        [8527872, 257],
        [33817600, 524352],
        [67371072, 262176],
        [8519688, 131088],
        [2181054464, 524288],
        [10485760, 32772],
        [9439232, 8194],
        [16850944, 65538],
        [4260864, 65538],
        [537002496, 2101248],
        [34079232, 1049600],
        [268468256, 10240],
        [134250498, 131200],
        [16793600, 65552],
        [4259968, 524800],
        [33686016, 524352],
        [4211200, 262400],
        [2105344, 133124],
        [1048832, 69640],
        [131104, 133124],
        [537395712, 8320],
        [537002016, 4194432],
        [65600, 131202],
        [2147616768, 66048],
        [1073873408, 131136],
        [67125248, 66576],
        [33556480, 131344],
        [603981824, 5120],
        [402653440, 32],
        [67108928, 2049],
        [1077936256, 4198400],
        [8389120, 2097410],
        [2181038208, 524416],
        [272629760, 16898],
        [2216689664, 65664],
        [2214854656, 512],
        [1107427328, 0],
        [33685504, 16],
        [33685504, 8194],
        [8421376, 2105348],
        [4325376, 1049090],
        [134365184, 4226],
        [17047552, 34],
        [8913920, 1],
        [2131968, 0],
        [268567040, 0],
        [537133312, 4],
        [17039488, 16392],
        [33571328, 135170]
    ]; 
    static ROOK_MAGICS = [ // [square]
        [4194336, 8392832],
        [4202496, 4194320],
        [8392704, 8390688],
        [524416, 8389648],
        [2147745794, 8390656],
        [134349056, 16778240],
        [16777728, 8388736],
        [2113792, 8388736],
        [1073774592, 32800],
        [8396800, 32832],
        [536875008, 32896],
        [134221824, 32896],
        [262272, 32776],
        [8389120, 32772],
        [8388864, 32770],
        [1082130688, 32768],
        [2113536, 32896],
        [2097216, 1048640],
        [268443648, 32896],
        [134221824, 32896],
        [67110912, 557184],
        [33555456, 32896],
        [131076, 257],
        [8454212, 512],
        [2147516448, 16384],
        [2155880448, 16384],
        [2148532352, 8192],
        [2155874304, 4096],
        [2155873280, 2048],
        [2147745920, 512],
        [131076, 65537],
        [2147500288, 294912],
        [4202496, 8388672],
        [4202496, 16400],
        [2155880448, 4096],
        [2155876352, 2048],
        [8390656, 32772],
        [8389632, 32770],
        [16777728, 65540],
        [1082130688, 32768],
        [2147516448, 16384],
        [4210688, 1048608],
        [1114176, 65568],
        [134250512, 1048704],
        [134250624, 1024],
        [33587328, 1024],
        [65792, 1026],
        [4325380, 129],
        [4194368, 8388640],
        [1074790464, 8192],
        [268468352, 8192],
        [268468352, 2048],
        [2147745920, 2048],
        [131200, 32772],
        [262400, 65538],
        [16512, 32769],
        [2147549201, 16416],
        [272629889, 8448],
        [151003137, 16400],
        [2701133829, 4096],
        [100927489, 65552],
        [524805, 65540],
        [2281767428, 4096],
        [1141014562, 256]
    ];
    static BISHOP_MASKS = this.mask_all_bishop_attacks();
    static ROOK_MASKS = this.mask_all_rook_attacks();
    static BISHOP_ATTACKS = this.bishop_attack();
    static ROOK_ATTACKS = this.rook_attack();
    
    static get_occupancy(index, free_bits_in_mask, attack_mask) {
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
    static mask_bishop_attacks(square) {
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
    static mask_rook_attacks(square) {
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
    static sliding_moves(square, blocker, start_dir_index, end_dir_index) {
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

    //#region CONSTANTS
    static squares_to_edge() {
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
    static pawn_attack() {
        let res = [new Array(64), new Array(64)];
        for (let i = 0; i < 64; i++) { // player
            let col = i & 7;
    
            let player = [0, 0];
            if (8 < i && 0 < col) { set_bit(player, i - 9); }
            if (6 < i && col < 7) { set_bit(player, i - 7); }
            res[0][i] = player;
    
            let ai = [0, 0];
            if (i < 57 && 0 < col) { set_bit(ai, i + 7); }
            if (i < 55 && col < 7) { set_bit(ai, i + 9); }
            res[1][i] = ai;
        }
    
        return res;
    }
    static knight_attack() {
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
    static king_attack() {
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
    static mask_all_bishop_attacks() {
        let res = new Array(64);
        for (let i = 0; i < 64; i++) {
            res[i] = this.mask_bishop_attacks(i);
        }
        return res;
    }
    static mask_all_rook_attacks() {
        let res = new Array(64);
        for (let i = 0; i < 64; i++) {
            res[i] = this.mask_rook_attacks(i);
        }
        return res;
    }
    static bishop_attack() {
        let res = new Array(64);
        for (let i = 0; i < 64; i++) {
            let r = new Array(512);
            let relevant_bits = this.BISHOP_RELEVANT_BITS[i];
            let occupancy_indicies = 1 << relevant_bits;
            for (let j = 0; j < occupancy_indicies; j++) {
                let occupancy = this.get_occupancy(j, relevant_bits, this.BISHOP_MASKS[i]);
                let magic_index = this.magic_index(occupancy, this.BISHOP_MAGICS[i], relevant_bits);
                r[magic_index] = this.sliding_moves(i, occupancy, 4, 8);
            }
            res[i] = r;
        }
        return res;
    }
    static rook_attack() {
        let res = new Array(64);
        for (let i = 0; i < 64; i++) {
            let r = new Array(4096);
            let relevant_bits = this.ROOK_RELEVANT_BITS[i];
            let occupancy_indicies = 1 << relevant_bits;
            for (let j = 0; j < occupancy_indicies; j++) {
                let occupancy = this.get_occupancy(j, relevant_bits, this.ROOK_MASKS[i]);
                let magic_index = this.magic_index(occupancy, this.ROOK_MAGICS[i], relevant_bits);
                r[magic_index] = this.sliding_moves(i, occupancy, 0, 4);
            }
            res[i] = r;
        }
        return res;
    }
    //#endregion

    static magic_index(occupancy, magic, bits) {
        return this.multupper_bitboards(occupancy, magic) >>> (32 - bits);
    }
    static get_bishop_attack(square, blocker) {
        let magic_index = this.magic_index(and_bitboards(blocker, this.BISHOP_MASKS[square]), this.BISHOP_MAGICS[square]) >>> (32 - this.BISHOP_RELEVANT_BITS[square]);
        return this.BISHOP_ATTACKS[square][magic_index];
    }
    static get_rook_attack(square, blocker) {
        let magic_index = this.magic_index(and_bitboards(blocker, this.ROOK_MASKS[square]), this.ROOK_MAGICS[square]) >>> (32 - this.ROOK_RELEVANT_BITS[square]);
        return this.ROOK_ATTACKS[square][magic_index];
    }
    static get_queen_attack(square, blocker) {
        return or_bitboards(this.get_bishop_attack(square, blocker), this.get_rook_attack(square, blocker));
    }

    //#region MAGIC GENERATION
    static mult32upper(a, b) {
        let ah = (a >> 16) & 0xFFFF, al = a & 0xFFFF;
        let bh = (b >> 16) & 0xFFFF, bl = b & 0xFFFF;
        return ((ah * bl) >>> 16) + ((al * bh) >>> 16) + (ah * bh);
    }
    static mult32lower(a, b) {
        let ah = (a >> 16) & 0xFFFF, al = a & 0xFFFF;
        let bh = (b >> 16) & 0xFFFF, bl = b & 0xFFFF;
        return al * bl + (((ah * bl + al * bh) & 0xFFFF) << 16);
    }
    static multupper_bitboards(b1, b2) { // incorrect multiplication result by -1 or -2 but consistently so to still work for magics
        return (this.mult32lower(b1[0], b2[1]) + this.mult32lower(b1[1], b2[0]) + this.mult32upper(b1[0], b2[0])) >>> 0;
    }

    // function rand(n) { return Math.floor(Math.random() * n); }
    static random_32() {
        return Math.floor(Math.random() * 0xFFFFFFFF);
    }
    static random_64() { 
        let x1 = this.random_32() & 0xffff;
        let x2 = this.random_32() & 0xffff;
        let x3 = this.random_32() & 0xffff;
        let x4 = this.random_32() & 0xffff;
        return [x1 | (x2 << 16), x3 | (x4 << 16)];
    }
    static random_magic() { 
        return and_bitboards(this.random_64(), and_bitboards(this.random_64(), and_bitboards(this.random_64(), this.random_64())));
    }

    static positive_bitboard(b) {
        let res = [0, 0];
        for (let i = 0; i < 32; i++) {
            if (get_bit(b, i)) {
                res[0] += Math.pow(2, i);
            }
            if (get_bit(b, i + 32)) {
                res[1] += Math.pow(2, i);
            }
        }
        return res;
    }

    static improve_magic(square, is_bishop, n=100000) {
        let best_magic = [this.ROOK_MAGICS[square], this.BISHOP_MAGICS[square]][is_bishop];
        let best_magic_bits = count_bits(best_magic);
        // if (best_magic_bits <= 6) { return best_magic; } // focus on magics > x

        let relevant_bits = [this.ROOK_RELEVANT_BITS[square], this.BISHOP_RELEVANT_BITS[square]][is_bishop];
        let occupancy_indicies = 1 << relevant_bits;
        let attack_mask = is_bishop ? this.mask_bishop_attacks(square) : this.mask_rook_attacks(square);

        let max_occupancies = [4096, 512][is_bishop];
        let slide_start = [0, 4][is_bishop];
        let occupancies = new Array(max_occupancies);
        let attacks = new Array(max_occupancies);
        let used_attacks = new Array(max_occupancies);
        for (let i = 0; i < occupancy_indicies; i++) {
            occupancies[i] = this.get_occupancy(i, relevant_bits, attack_mask);
            attacks[i] = this.sliding_moves(square, occupancies[i], slide_start, slide_start + 4);
        }

        for (; n > 0; n--) {
            let magic = this.random_magic();
            
            let bits = count_bits(magic);
            if (bits >= best_magic_bits) {
                continue;
            }

            for (let i = 0; i < used_attacks.length; i++) { used_attacks[i] = [0, 0]; }
            let fail = 0;
            for (let i = 0; !fail && i < occupancy_indicies; i++) {
                let magic_index = this.multupper_bitboards(occupancies[i], magic) >>> (32 - relevant_bits);
                if (!bool_bitboard(used_attacks[magic_index])) {
                    used_attacks[magic_index] = attacks[i];
                } else if (used_attacks[magic_index][0] != attacks[i][0] || used_attacks[magic_index][1] != attacks[i][1]) {
                    fail = 1;
                }
            }
            if (!fail) {
                best_magic = magic;
                best_magic_bits = bits;
                console.log(("RB"[is_bishop]) + " - FOUND " + (bits) + " - [" + (best_magic[0]) + "," + (best_magic[1]) + "]");
            }
        }
        if (best_magic[0] < 0 || best_magic[1] < 0) {
            return this.positive_bitboard(best_magic);
        }
        return best_magic;
    }

    static improve_all_magics(n=100000) {
        let b = [];
        let r = [];
        for (let i = 0; i < 64; i++) {
            let bm = this.improve_magic(i, 1, n);
            let rm = this.improve_magic(i, 0, n);
            bm[0] = bm[0].toString().padStart(10, " ");
            bm[1] = bm[1].toString().padStart(10, " ");
            rm[0] = rm[0].toString().padStart(10, " ");
            rm[1] = rm[1].toString().padStart(10, " ");
            console.log((i) + " - [" + bm[0] + "," + bm[1] + "],[" + rm[0] + "," + rm[1] + "]");
            b.push(bm);
            r.push(rm);
        }
        this.format_magics(b, r);
    }

    static format_magics(bishops, rooks) {
        function format_arr(arr, name) {
            let res = "let " + name + " = [";
            for (let i = 0; i < 64; i++) {
                if (arr[i]) {
                    res += "[" + arr[i][0] + ", " + arr[i][1] + "],";
                } else {
                    res += "[0, 0],";
                }
            }
            res += "];";
            return res;
        }
        console.log(format_arr(bishops, "BISHOP_MAGICS"));
        console.log(format_arr(rooks, "ROOK_MAGICS"));
    }

    static test_magics(n=1000) {
        for (let i = 0; i < 64; i++) {
            for (let j = 0; j < n; j++) {
                let occ = and_bitboards(this.random_64(), this.random_64());
                let b1 = this.get_bishop_attack(i, occ);
                let r1 = this.get_rook_attack(i, occ);
                let b2 = this.sliding_moves(i, occ, 4, 8);
                let r2 = this.sliding_moves(i, occ, 0, 4);
                if (b1[0] != b2[0] || b1[1] != b2[1]) {
                    console.log((i) + " BISHOP WRONG");
                    print_bitboard(occ);
                    print_bitboard(b1);
                    print_bitboard(b2);
                    return "FAIL";
                }
                if (r1[0] != r2[0] || r1[1] != r2[1]) {
                    console.log((i) + " ROOK WRONG");
                    print_bitboard(occ);
                    print_bitboard(r1);
                    print_bitboard(r2);
                    return "FAIL";
                }
            }
        }
        return "PASS";
    }
    //#endregion
}

// BOARD ----------------------------------------------------------------------------------------------------------------------
class Game_State {
    constructor(capturedPiece, enpassant, castle, fifty) {
        this.capturedPiece = capturedPiece;
        this.enpassant = enpassant;
        this.castle = castle;
        this.fifty = fifty;
    }
}

class Board {
    constructor(fen) {
        /*
            this.squares - 64 array of pieces, index offset by 1 for 0=none
            this.bitboards - 15 bitboards - 6 white, 6 black, 3 occupancy
            this.turn - w = 0, b = 1
            this.castle
            this.enpassant
            this.fifty
            this.capturedPiece - for unmake move
        */

        // BITBOARDS 
        this.squares = new Array(64).fill(0);
        let split_fen = fen.split(" ");
        let row = 0, col = 0;
        let pieces = "PNBRQKpnbrqk";
        for (let i = 0; i < split_fen[0].length; i++) {
            let char = fen[i];
            if (char == "/") { row++; col = 0; } 
            else if (!isNaN(char)) { col += parseInt(char); } 
            else { this.squares[(row << 3) + col] = pieces.indexOf(char) + 1; col++; }
        }
        this.bitboards = new Array(15);
        for (let i = 0; i < 15; i++) { this.bitboards[i] = [0, 0]; }
        for (let i = 0; i < 64; i++) { // pieces
            let piece = this.squares[i];
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

        // OTHERS
        this.capturedPiece = 0;
    }

    get_game_state() {
        return new Game_State(this.capturedPiece, this.enpassant, this.castle, this.fifty);
    }

    load_game_state(gameState) {
        this.capturedPiece = gameState.capturedPiece;
        this.enpassant = gameState.enpassant;
        this.castle = gameState.castle;
        this.fifty = gameState.fifty;
    }

    is_square_attacked(square, side) {
        let att_piece = side * 6;
        // Attacked by knights
        if (bool_bitboard(and_bitboards(Move_Helper.KNIGHT_ATTACK[square], this.bitboards[att_piece + 1]))) { return 2; }
        // Attacked by bishops
        let bishop_att = Move_Helper.get_bishop_attack(square, this.bitboards[14]);
        if (bool_bitboard(and_bitboards(bishop_att, this.bitboards[att_piece + 2]))) { return 3; }
        // Attacked by rooks
        let rook_att = Move_Helper.get_rook_attack(square, this.bitboards[14]);
        if (bool_bitboard(and_bitboards(rook_att, this.bitboards[att_piece + 3]))) { return 4; }
        // Attacked by queens
        if (bool_bitboard(and_bitboards(or_bitboards(bishop_att, rook_att), this.bitboards[att_piece + 4]))) { return 5; }
        // Attacked by pawns
        if (bool_bitboard(and_bitboards(Move_Helper.PAWN_ATTACK[side ^ 1][square], this.bitboards[att_piece]))) { return 1; }
        // Attacked by kings
        if (bool_bitboard(and_bitboards(Move_Helper.KING_ATTACK[square], this.bitboards[att_piece + 5]))) { return 6; }
        
        return 0;
    }

    generate_moves() {
        let moves = [];
        // Pawn moves
        let piece = 6 * this.turn;
        let piece_board = copy_bitboard(this.bitboards[piece]);
        let pawn_direction = [-8, 8][this.turn];
    
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
            let attacks = and_bitboards(Move_Helper.PAWN_ATTACK[this.turn][source], this.bitboards[opp_occ]);
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
        if (this.enpassant) {
            piece_board = and_bitboards(Move_Helper.PAWN_ATTACK[this.turn ^ 1][this.enpassant], this.bitboards[piece]);
            while (bool_bitboard(piece_board)) {
                let source = pop_lsb_index(piece_board);
                moves.push(create_move(source, this.enpassant, piece, 0, 1, 0, 1));
            }
        }
        // Knight moves
        piece++;
        piece_board = copy_bitboard(this.bitboards[piece]);
        while(bool_bitboard(piece_board)) {
            let source = pop_lsb_index(piece_board);
            let attacks = nand_bitboards(Move_Helper.KNIGHT_ATTACK[source], this.bitboards[curr_occ]);
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
            let attacks = nand_bitboards(Move_Helper.get_bishop_attack(source, this.bitboards[14]), this.bitboards[curr_occ]);
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
            let attacks = nand_bitboards(Move_Helper.get_rook_attack(source, this.bitboards[14]), this.bitboards[curr_occ]);
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
            let attacks = nand_bitboards(Move_Helper.get_queen_attack(source, this.bitboards[14]), this.bitboards[curr_occ]);
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
        let attacks = nand_bitboards(Move_Helper.KING_ATTACK[source], this.bitboards[curr_occ]);
        while (bool_bitboard(attacks)) {
            let att = pop_lsb_index(attacks);
            moves.push(create_move(source, att, piece, 0, get_bit(this.bitboards[opp_occ], att)));
        }

        // Castling
        if (this.castle) {
            let king_pos = [60, 4][this.turn];
            if (([this.castle & 1, this.castle & 4][this.turn]) && !get_bit(this.bitboards[14], king_pos + 1) && !get_bit(this.bitboards[14], king_pos + 2) && !this.is_square_attacked(king_pos, this.turn ^ 1) && !this.is_square_attacked(king_pos + 1, this.turn ^ 1)) {
                moves.push(create_move(king_pos, king_pos + 2, piece, 0, 0, 0, 0, 1));
            }
            if (([this.castle & 2, this.castle & 8][this.turn]) && !get_bit(this.bitboards[14], king_pos - 1) && !get_bit(this.bitboards[14], king_pos - 2) && !get_bit(this.bitboards[14], king_pos - 3) && !this.is_square_attacked(king_pos, this.turn ^ 1) && !this.is_square_attacked(king_pos - 1, this.turn ^ 1)) {
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
    
        let curr_occ = 12 + this.turn;
        let opp_occ = 13 - this.turn;
    
        // Remove captured piece and enpassant
        if (get_move_capture(move)) {
            let capture_square = get_move_enpassant(move) ? [target + 8, target - 8][this.turn] : target;
            this.capturedPiece = this.squares[capture_square];
            pop_bit(this.bitboards[this.capturedPiece - 1], capture_square);
            pop_bit(this.bitboards[opp_occ], capture_square);
            pop_bit(this.bitboards[14], capture_square);
            this.squares[capture_square] = 0;
        }

        // Move piece
        pop_bit(this.bitboards[piece], source);
        pop_bit(this.bitboards[curr_occ], source);
        pop_bit(this.bitboards[14], source);
        set_bit(this.bitboards[piece], target);
        set_bit(this.bitboards[curr_occ], target);
        set_bit(this.bitboards[14], target);

        // Set squares
        this.squares[source] = 0;
        this.squares[target] = piece + 1;
    
        // Set promote piece
        let promote_piece = get_move_promote(move);
        if (promote_piece) {
            pop_bit(this.bitboards[piece], target);
            set_bit(this.bitboards[promote_piece], target);
            this.squares[target] = promote_piece + 1;
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
            this.squares[rook_source] = 0;
            this.squares[rook_target] = piece - 1;
        } 

        // Set enpassant
        this.enpassant = get_move_double(move) ? [target + 8, target - 8][this.turn] : 0;

        // Update castle
        this.castle &= Move_Helper.CASTLING_RIGHTS[source];
        this.castle &= Move_Helper.CASTLING_RIGHTS[target];

        // Moving into check, reset state
        // TODO

        this.turn ^= 1;
        return true;
    }

    undo_move(move) {
        if (!move) { return false; }
        let source = get_move_source(move);
        let target = get_move_target(move);
        let piece = get_move_piece(move);
    
        let curr_occ = 13 - this.turn;
        let opp_occ = 12 + this.turn;

        // Reset promotion
        let promote_piece = this.squares[target];
        if (promote_piece) {
            pop_bit(this.bitboards[promote_piece - 1], target);
            // dont need to set piece occ because pop below
            this.squares[target] = piece + 1;
        }

        // Move piece
        pop_bit(this.bitboards[piece], target);
        pop_bit(this.bitboards[curr_occ], target);
        pop_bit(this.bitboards[14], target);
        set_bit(this.bitboards[piece], source);
        set_bit(this.bitboards[curr_occ], source);
        set_bit(this.bitboards[14], source);

        // Reset squares
        this.squares[source] = piece + 1;
        this.squares[target] = 0;

        // Reset captured piece and enpassant
        this.enpassant = 0;
        if (get_move_capture(move)) {
            let enpassant = get_move_enpassant(move) ? 1 : 0;
            let capture_square = [target, target + 8 - (this.turn << 4)][enpassant];
            this.enpassant = [0, target][enpassant];

            this.squares[target] = this.capturedPiece;
            set_bit(this.bitboards[this.capturedPiece - 1], capture_square);
            set_bit(this.bitboards[opp_occ], capture_square);
            set_bit(this.bitboards[14], capture_square);
        }
        // Reset castle 
        else if (get_move_castle(move)) {
            let kingside = (target == 62) || (target == 6);
            let rook_source = (kingside) ? target + 1 : target - 2;
            let rook_target = (kingside) ? target - 1 : target + 1;

            pop_bit(this.bitboards[piece - 2], rook_target);
            pop_bit(this.bitboards[curr_occ], rook_target);
            pop_bit(this.bitboards[14], rook_target);
            set_bit(this.bitboards[piece - 2], rook_source);
            set_bit(this.bitboards[curr_occ], rook_source);
            set_bit(this.bitboards[14], rook_source);
            this.squares[rook_target] = 0;
            this.squares[rook_source] = piece - 1;
        } 

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

        res = "";
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                let k = (i << 3) + j;
                let piece = this.squares[k].toString();
                if (piece.length == 1) { piece = " " + piece; } 
                res += piece + " ";
            }
            res += "\n";
        }
        console.log(res);
    }

    copy_bitboards() {
        let res = [];
        let bitboards = this.bitboards;
        for (let i = 0; i < bitboards.length; i++) {
            res.push(copy_bitboard(bitboards[i]));
        }
        return res;
    }

    perft(depth, print=true) {
        if (depth == 0) { return 1; }
        let res = 0;
        let moves = this.generate_moves();
        for (let i = 0; i < moves.length; i++) {
            let move = moves[i];

            let sq = this.squares;
            let bi = this.copy_bitboards();
            let tu = this.turn;
            let ca = this.castle;
            let en = this.enpassant;

            this.do_move(move);

            let start_res = res;
            res += this.perft(depth - 1, false);
            if (print) {
                console.log(get_move_uci(move) + "\t->\t" + (res - start_res));
            }

            this.squares = sq;
            this.bitboards = bi;
            this.turn = tu;
            this.castle = ca;
            this.enpassant = en;
        }
        return res;
    }
}

// GAME ----------------------------------------------------------------------------------------------------------------------
class Game {
    static START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    static PLAYER_TIMER_INTERVALS = [];

    constructor(playerWhite, fen=Game.START_FEN, timer=10*60*1000, timerIncrement=2) {
        this.fen = fen;
        this.playerWhite = playerWhite;

        this.board = new Board(this.fen);
        this.moves = [0];
        this.game_states = [this.board.get_game_state()];

        Game.PLAYER_TIMER_INTERVALS.map((item) => clearInterval(Game.PLAYER_TIMER_INTERVALS.pop()));

        this.playerTimer = new Timer("playerTimer", timer, timerIncrement);
        this.botTimer = new Timer("botTimer", timer, timerIncrement);
        this.bot = new Bot();

        this.make_table();
        this.display();

        if (this.board.turn == +this.playerWhite) {
            this.do_ai_move()
        }
    }

    undo() {
        for (let i = 0; i < 2 && this.moves.length > 1; i++) {
            this.board.undo_move(this.moves.pop());
            this.board.load_game_state(this.game_states.pop());
        }
        this.display(true);
    }

    make_table() {
        let table = '<table id="chess-table" class="chess-board">';
        let row_order = ["12345678", "87654321"][+this.playerWhite];
        let col_order = ["hgfedcba", "abcdefgh"][+this.playerWhite];
        for (let row = 0; row < 8; row++) {
            table += '<tr>';
            for (let col = 0; col < 8; col++) {
                let colour_class = ['light', 'dark'][((row + col) % 2)];
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
            if (get_move_promote(move)) { // ask for promote input
                let input = window.prompt("N B R Q: ").toUpperCase() + " ";
                let value = "NBRQ".indexOf(input[0]) + 1;
                if (!value) { value = 4; }
                let promote_piece = get_move_piece(move) + value;
                move = (move & 15794175) | (promote_piece << 16);
            }
            this.board.do_move(move);
            this.moves.push(move); // TODO: maybe move the moves and game_states out to board? Then handle push/pop in make and unmake
            this.game_states.push(this.board.get_game_state());
            this.display();

            this.playerTimer.stop();
            this.botTimer.start();

            this.do_ai_move()
            return true;
        }
        return false;
    }

    do_ai_move() {
        window.setTimeout(() => this.do_ai_move_delayed(), 50); // Increase the delay here if page not displayed while bot thinking
    }

    do_ai_move_delayed() {
        clearInterval(Game.PLAYER_TIMER_INTERVALS.pop());
        let move = this.bot.think(this.board);
        this.board.do_move(move);
        this.moves.push(move);
        this.game_states.push(this.board.get_game_state());
        this.display();

        this.botTimer.stop();
        this.playerTimer.start();
    }

    display(updateAll=false) {
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
                        let d = document.getElementById("s" + (i));
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
                    i = [63 - i, i][+game_inst.playerWhite];
                    document.getElementById("s" + (i)).onclick = null;
                }
                // override legal moves onclick
                for (let i = 0; i < legal_moves.length; i++) {
                    if (legal_moves[i][0] == pos) {
                        let new_pos = legal_moves[i][1];
                        document.getElementById("s" + (new_pos)).onclick = () => {
                            let row_diff = (new_pos >> 3) - (pos >> 3);
                            let col_diff = (new_pos & 7) - (pos & 7);
                            div.style.top = (width * row_diff + top_offset) + "px";
                            div.style.left = (width * col_diff + left_offset) + "px";
                            window.setTimeout(() => game_inst.do_player_move(pos, new_pos), 20);
                        };
                    }
                }
            }
        }

        // Update timers
        if (this.playerWhite != this.board.turn) {           
            let playerTimer = this.playerTimer;
            let botTimer = this.botTimer;
            let interval = setInterval(function() {
                playerTimer.update();
                botTimer.update();
            }, 1000);
            Game.PLAYER_TIMER_INTERVALS.push(interval);
        }
        // Update board
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
        let indicies = new Array(64).fill(0).map((item, index) => index);
        if (!updateAll && last_move) {
            // Update pieces affected by last move
            indicies = [last_move_source, last_move_target];
            if (get_move_castle(last_move)) {
                let kingside = (last_move_target == 62) || (last_move_target == 6);
                let rook_source = (kingside) ? last_move_target + 1 : last_move_target - 2;
                let rook_target = (kingside) ? last_move_target - 1 : last_move_target + 1;
                indicies.push(rook_source);
                indicies.push(rook_target);
            }
            if (get_move_enpassant(last_move)) {
                let s = last_move_target + 8 - (this.turn << 4);
                indicies.push(s);
            }
            // Update player pieces to allow movement
            for (let i = 0; i < 64; i++) {
                let b = [63 - i, i][+this.playerWhite];
                let j = this.board.squares[b];
                if (j) {
                    j--;
                    if (this.playerWhite == (j < 6) && this.playerWhite != this.board.turn) {
                        indicies.push(i);
                    }
                }
            }
        }
        for (let index = 0; index < indicies.length; index++) {
            let i = indicies[index];
            let piece_location = table.rows.item(i >> 3).cells.item(i & 7);

            if (piece_location.hasChildNodes()) { piece_location.removeChild(piece_location.childNodes[0]); }
            piece_location.style.background = "";

            let b = [63 - i, i][+this.playerWhite];
            let j = this.board.squares[b];
            if (j) {
                j--;
                let piece = '<img draggable="false" style="width: ' + (width - 10) + 'px; height: ' + (width - 10) + 'px;" src="../imgs/chess_pieces/' + (j) + '.png">';

                let piece_div = document.createElement('div');
                piece_div.id = i;
                piece_div.className = "chess-piece";
                piece_div.innerHTML = piece;
                piece_location.appendChild(piece_div);

                piece_drag(this, piece_div, i, this.playerWhite == (j < 6) && this.playerWhite != this.board.turn, legal_moves);
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

// HTML FUNCTIONS
//#region
function new_game() { game = new Game(true); }
function switch_sides() { game = new Game(!game.playerWhite, game.fen); }
//#endregion

// let game = new Game(true);
// let game = new Game(true, 10000, "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8");
// let game = new Game(true, "rnbqkbnr/ppppp1pp/8/4Pp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 1"); // white enpassant
let game = new Game(false, "rnbqkbnr/pp1ppppp/8/4P3/2pP4/8/PPP2PPP/RNBQKBNR b KQkq d3 0 3"); // black enpassant
window.onresize = () => { game.display(true); };