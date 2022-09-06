let basic_piece_values = [
    100, 525, 350, 350, 1000, 0,
];

let basic_m = [
    // pawn
    [
        0,  0,  0,  0,  0,  0,  0,  0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
        5,  5, 10, 25, 25, 10,  5,  5,
        0,  0,  0, 20, 20,  0,  0,  0,
        5, -5,-10,  0,  0,-10, -5,  5,
        5, 10, 10,-20,-20, 10, 10,  5,
        0,  0,  0,  0,  0,  0,  0,  0
    ],

    //rook
    [
        0,  0,  0,  0,  0,  0,  0,  0,
        5, 10, 10, 10, 10, 10, 10,  5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        0,  0,  0,  5,  5,  0,  0,  0
    ],
 
    // knight
    [
        -50,-40,-30,-30,-30,-30,-40,-50,
        -40,-20,  0,  0,  0,  0,-20,-40,
        -30,  0, 10, 15, 15, 10,  0,-30,
        -30,  5, 15, 20, 20, 15,  5,-30,
        -30,  0, 15, 20, 20, 15,  0,-30,
        -30,  5, 10, 15, 15, 10,  5,-30,
        -40,-20,  0,  5,  5,  0,-20,-40,
        -50,-40,-30,-30,-30,-30,-40,-50
    ],
 
    // bishop
    [
        -20,-10,-10,-10,-10,-10,-10,-20,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -10,  0,  5, 10, 10,  5,  0,-10,
        -10,  5,  5, 10, 10,  5,  5,-10,
        -10,  0, 10, 10, 10, 10,  0,-10,
        -10, 10, 10, 10, 10, 10, 10,-10,
        -10,  5,  0,  0,  0,  0,  5,-10,
        -20,-10,-10,-10,-10,-10,-10,-20
    ],
        
    //queen
    [
        -20,-10,-10, -5, -5,-10,-10,-20,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -10,  0,  5,  5,  5,  5,  0,-10,
        -5,  0,  5,  5,  5,  5,  0, -5,
        0,  0,  5,  5,  5,  5,  0, -5,
        -10,  5,  5,  5,  5,  5,  0,-10,
        -10,  0,  5,  0,  0,  0,  0,-10,
        -20,-10,-10, -5, -5,-10,-10,-20
    ],
        
    //king
    [
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -20,-30,-30,-40,-40,-30,-30,-20,
        -10,-20,-20,-20,-20,-20,-20,-10,
        20, 20,  0,  0,  0,  0, 20, 20,
        20, 30, 10,  0,  0, 10, 30, 20
    ]
];

function basic_piece_val_map(piece, pos) {
    if (piece >= 6) {
        piece -= 6;
        pos += (7 - (pos / 8 << 1)) << 3; // flip rows
    }
    if (!PLAYER_WHITE) {
        pos += 7 - (pos % 8 << 1); // flip cols
    }
    return basic_piece_values[piece] + basic_m[piece][pos];
}

function basic_evaluate_board() { // LOWER BOUND
    let res = 0;
    for (let piece = 0; piece < 12; piece++) {
        let theboard = copy_bitboard(BOARD[piece]);
        while (bool_bitboard(theboard)) {
            let index = lsb_index(theboard);

            if (piece < 6) { // player
                res += basic_piece_val_map(piece, index);
            } else { // ai
                res -= basic_piece_val_map(piece, index);
            }

            pop_bit(theboard, index);
        }
    }
    return (TURN) ? -res : res;
}

function basic_score_move(move) { // IMPORTANT
    let target = get_move_target(move); 
    let piece = get_move_piece(move);

    if (get_move_capture(move)) {
        for (let i = 6 * (1 - TURN); i < 6 * (1 - TURN) + 6; i++) {
            if (get_bit(BOARD[i], target)) {
                return 10005 - piece % 6 + 100 * (i % 6 + 1);
            }
        }
        // En passant
        return 10105;
    }
}

function basic_order_moves(moves) {
    let res = [];
    for (let i = 0; i < moves.length; i++) {
        let entry = [basic_score_move(moves[i]), moves[i]];
        res.push(entry);
    }
    res.sort(function(a, b) { return b[0] - a[0]; });
    for (let i = 0; i < res.length; i++) {
        res[i] = res[i][1];
    }
    return res;
}

// SEARCH -----------------------------------------------------------------------------------------------------------------------------------------------

function basic_best_eval_captures(alpha, beta, depth) {
    COUNT++;

    let stand_pat = basic_evaluate_board();
    if (ply >= MAX_PLY || depth == 0) {
        return stand_pat;
    } else if (stand_pat >= beta) { // beta cutoff
        return beta;
    } else if (stand_pat < alpha - 900) { // delta pruning
        return alpha;
    } else if (stand_pat > alpha) {
        alpha = stand_pat;
    } 

    let moves = basic_order_moves(generate_capture_moves());
    for (let i = 0; i < moves.length; i++) {
        let move = moves[i];

        // Copy state
        let cb = copy_board(BOARD);
        let cc = CASTLE;
        let copy_en = EN_PASSANT_SQUARE;
        let copy_turn = TURN;
        let copy_hash = copy_bitboard(hash_key);

        // Do move
        if (!do_move(move)) {
            continue;
        }
        
        ply++;
        let eval = -basic_best_eval_captures(-beta, -alpha, depth - 1);
        ply--;

        // Reset state
        BOARD = cb;
        CASTLE = cc;
        EN_PASSANT_SQUARE = copy_en;
        TURN = copy_turn;
        hash_key = copy_hash;

        if (eval >= beta) { // Opponent response too stong, snip this move
            return beta;
        } 
        if (eval > alpha) {
            alpha = eval;
        }
    }
    return alpha;
}

function basic_best_eval(depth, alpha, beta) {
    pv_length[ply] = ply;

    if (depth == 0) { return basic_best_eval_captures(alpha, beta, 5); }
    if (ply >= MAX_PLY) { return basic_evaluate_board(); }

    COUNT++;
    let moves = generate_pseudo_moves();

    moves = basic_order_moves(moves);
    let legal_moves = 0;
    for (let i = 0; i < moves.length; i++) {
        let move = moves[i];

        // Copy state
        let cb = copy_board(BOARD);
        let cc = CASTLE;
        let copy_en = EN_PASSANT_SQUARE;
        let copy_turn = TURN;
        let copy_hash = copy_bitboard(hash_key);

        // Do move
        if (!do_move(move)) {
            continue;
        }
        
        legal_moves++;
        ply++
        let eval = -basic_best_eval(depth - 1, -beta, -alpha);
        ply--;

        // Reset state
        BOARD = cb;
        CASTLE = cc;
        EN_PASSANT_SQUARE = copy_en;
        TURN = copy_turn;
        hash_key = copy_hash;
        
        if (eval >= beta) { // Opponent response too stong, snip this move
            return beta;
        }

        if (eval > alpha) {
            alpha = eval;

            pv_table[ply][ply] = move; // write PV move
            for (let next_ply = ply + 1; next_ply < pv_length[ply + 1]; next_ply++) { 
                pv_table[ply][next_ply] = pv_table[ply + 1][next_ply]; 
            }
            pv_length[ply] = pv_length[ply + 1];
        }        
    }
    
    if (!legal_moves) {
        let king_pos = (TURN) ? lsb_index(BOARD[11]) : lsb_index(BOARD[5]);
        if (king_pos == -1) { document.getElementById("error").innerHTML = "<p>NO KING</p>"; console.log("WHAT THE"); return -100000; }

        if (is_square_attacked(king_pos, TURN ^ 1)) {
            return -100000 + ply;
        }
        return 0;
    }
    return alpha;
}

function basicSearch(depth) {
    pv_length = new Array(MAX_PLY); // ply
    pv_table = new Array(MAX_PLY); // ply, ply
    for (let i = 0; i < MAX_PLY; i++) { pv_table[i] = new Array(MAX_PLY); }

    COUNT = 0; LOOKUP = 0; ply = 0;

    console.log("Lookahead:", depth);
    let eval = 0; let start = performance.now(); 
    for (let current_depth = 1; current_depth <= depth; current_depth++) {

        eval = basic_best_eval(current_depth, -Infinity, Infinity);

        let res = "Depth: " + (current_depth) + ", analysed: " + (COUNT) + ", eval: " + (eval) + ", PV: ";
        for (let i = 0; i < pv_length[0]; i++) {
            res += get_move_desc(pv_table[0][i]) + " ";
        }
        console.log(res);
    } 
    if (TURN && PLAYER_WHITE) {
        eval *= -1;
    }
    if (pv_table[0][0]) {
        console.log("Best move: " + (get_move_desc(pv_table[0][0])) + ", eval: " + (eval));
    }
    console.log(" ");

    return [eval, Math.round(performance.now() - start), generate_pseudo_moves()];
}
