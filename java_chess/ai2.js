function reset_search_tables() {
    COUNT = 0; 
    LOOKUP = 0;
    follow_pv = 0; 
    score_pv = 0;

    killer_moves = [new Array(MAX_PLY).fill(0), new Array(MAX_PLY).fill(0)];
    history_moves = new Array(12); // piece, square
    for (let i = 0; i < 12; i++) { history_moves[i] = new Array(64).fill(0); }

    pv_length = new Array(MAX_PLY).fill(0); // ply
    pv_table = new Array(MAX_PLY); // ply, ply
    for (let i = 0; i < MAX_PLY; i++) { pv_table[i] = new Array(MAX_PLY).fill(0); }
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

function piece_val_map(piece, pos) {
    if (piece >= 6) {
        piece -= 6;
        pos += 56 - (pos >> 3 << 4); // flip rows
    }
    return piece_values[piece] + piece_position_values[piece][pos];
    return piece_values[piece + 6] + piece_position_values[piece + 6][pos]; 
}

function evaluate_board() {
    let res = 0;
    for (let p = 0; p < 5; p++) {
        let bitboard = copy_bitboard(BOARD[p]);
        while (bool_bitboard(bitboard)) {
            res += piece_val_map(p, pop_lsb_index(bitboard));
        }

        bitboard = copy_bitboard(BOARD[p + 6]);
        while (bool_bitboard(bitboard)) {
            res -= piece_val_map(p + 6, pop_lsb_index(bitboard));
        }
    }
    return (TURN) ? -res : res;
}

function score_move(move, attackers, defenders) {
    if (score_pv && move == pv_table[0][ply]) {
        score_pv = 0;
        return 200;
    }

    let target = get_move_target(move); 
    let piece = get_move_piece(move);
    let piece_type = piece % 6;

    if (get_move_capture(move)) {
        let res = 150 + defenders[target] - (get_bit(attackers, target) ? 5 : 0);
        for (let i = 0; i < 6; i++) {
            if (get_bit(BOARD[i + 6 * TURN], target)) {
                return res + ((i % 6 - piece_type) << 1);
            }
        }
        return res; // enpassant
    }
    if (move == killer_moves[0][ply]) { return 130; }
    if (move == killer_moves[1][ply]) { return 125; }
    return Math.min(120, history_moves[piece][target]);
}

function order_moves(moves) {
    let attackers = opponent_att_mask();
    let defenders = new Array(64).fill(-1);
    for (let i = 0; i < moves.length; i++) {
        let move = moves[i];
        if (get_move_capture(move)) {
            defenders[get_move_target(move)] += 1 + (get_move_piece(move) % 6 ? 0 : 1);
        }
    }
    let res = [];
    for (let i = 0; i < moves.length; i++) {
        let entry = [score_move(moves[i], attackers, defenders), moves[i]];
        res.push(entry);
    }
    res.sort(function(a, b) { return b[0] - a[0]; });
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
let PRINT_COUNT = 0;
function best_eval_captures(depth, alpha, beta) {
    COUNT++;

    let stand_pat = evaluate_board();
    if (stand_pat >= beta) { return beta; } // beta cutoff
    // else if (stand_pat < alpha - 900) { return alpha; } // delta pruning
    else if (stand_pat > alpha) { alpha = stand_pat; }
    if (depth == 0) {  return stand_pat; }

    let moves = generate_capture_moves();
    moves = order_moves(moves);
    for (let i = 0; i < moves.length; i++) {
        let move = moves[i];

        let cb = copy_board(BOARD);
        let cc = CASTLE;
        let copy_en = EN_PASSANT_SQUARE;

        if (!do_move(move)) {
            continue;
        }

        GAME_HASH.push(copy_bitboard(hash_key));
        ply++;
        let eval = -best_eval_captures(depth - 1, -beta, -alpha);
        ply--;
    
        BOARD = cb;
        CASTLE = cc;
        EN_PASSANT_SQUARE = copy_en;
        TURN ^= 1;
        hash_key = GAME_HASH.pop();

        if (eval >= beta) { // oppenent response too strong, snip
            return beta
        }
        if (eval > alpha) {
            alpha = eval;
        }
    }
    return alpha;
}

function best_eval(depth, alpha, beta) {
    pv_length[ply] = ply;

    let score = HASH_TABLE.get(depth, alpha, beta);
    if (ply && score != null) {
        LOOKUP ++;
        return score;
    }

    if (depth == 0) { return best_eval_captures(8, alpha, beta); }

    let moves = generate_pseudo_moves();
    if (follow_pv) { enable_pv_scoring(moves); }
    moves = order_moves(moves);

    COUNT++;
    let hash_flag = 2;
    let legal_moves = false;
    for (let i = 0; i < moves.length; i++) {
        let move = moves[i];

        let cb = copy_board(BOARD);
        let cc = CASTLE;
        let copy_en = EN_PASSANT_SQUARE;
        let copy_turn = TURN;
        let copy_hash = copy_bitboard(hash_key);

        if (!do_move(move)) {
            continue;
        }
        legal_moves = true;

        GAME.push(copy_board(BOARD));
        GAME_HASH.push(copy_bitboard(hash_key));
        GAME_MOVES.push(get_move_uci(move));

        ply++;
        let eval = -best_eval(depth - 1, -beta, -alpha);
        ply--;

        GAME.pop();
        GAME_HASH.pop();
        GAME_MOVES.pop();

        BOARD = cb;
        CASTLE = cc;
        EN_PASSANT_SQUARE = copy_en;
        TURN = copy_turn;
        hash_key = copy_hash;

        if (eval >= beta) { // oppenent response too strong, snip
            HASH_TABLE.set(depth, 3, eval);
            if (!get_move_capture(move)) {
                killer_moves[1][ply] = killer_moves[0][ply];
                killer_moves[0][ply] = move;
            }
            return beta
        } else if (eval > alpha) {
            if (!get_move_capture(move)) {
                history_moves[get_move_piece(move)][get_move_target(move)] += depth * depth;
            }
            alpha = eval;
            hash_flag = 1;

            pv_table[ply][ply] = move; // write PV move
            for (let next_ply = ply + 1; next_ply < pv_length[ply + 1]; next_ply++) { 
                pv_table[ply][next_ply] = pv_table[ply + 1][next_ply]; 
            }
            pv_length[ply] = pv_length[ply + 1];
        }
    }
    if (!legal_moves) {
        if (is_square_attacked(lsb_index(BOARD[6 * TURN + 5]), TURN ^ 1)) {
            return -100000 + ply;
        }
        return 0;
    }
    HASH_TABLE.set(depth, hash_flag, alpha);
    return alpha;
}

function search(depth) {
    reset_search_tables();

    console.log("Lookahead:", depth);
    let eval;
    let start = performance.now();
    for (let current_depth = 1; current_depth <= depth; current_depth++) {
        follow_pv = 1;

        eval = best_eval(current_depth, -Infinity, Infinity);
        if (PLAYER_WHITE) { eval *= -1; }

        let res = "Depth: " + (current_depth) + ", analysed: " + (COUNT) + ", eval: " + (eval) + ", PV: ";
        for (let i = 0; i < pv_length[0]; i++) {
            res += get_move_san(pv_table[0][i]) + " ";
        }
        console.log(res);
        if (Math.abs(eval) > 99900) { break; }
    }
    let time = Math.round(performance.now() - start);
    console.log("Best move: " + (get_move_san(pv_table[0][0])) + ", eval: " + (eval) + ", time (ms): " + (time));
    console.log(" ");
    return [eval, time];
}

// MAIN -----------------------------------------------------------------------------------------------------------------------------------------------

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
let HASH_SIZE = 67108864;

let COUNT = 0;
let LOOKUP = 0;