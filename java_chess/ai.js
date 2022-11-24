function perft(depth, print=1) {
    if (depth == 0) { return 1; }
    
    let res = 0;
    let moves = generate_pseudo_moves();
    for (let i = 0; i < moves.length; i++) {
        let move = moves[i];

        // Copy state
        let cb = copy_board(BOARD);
        let copy_castle = CASTLE;
        let copy_en = EN_PASSANT_SQUARE;
        let copy_turn = TURN;

        // Do move
        if (!do_move(move)) {
            continue;
        }

        let start_res = res;
        res += perft(depth - 1, 0);   

        // Print 
        if (print) {
            let letters = "abcdefgh";
            let move_source = get_move_source(move);
            let move_target = get_move_target(move);
            let start_pos = letters[move_source % 8] + (8 - (move_source  >> 3));
            let end_pos = letters[move_target % 8] + (8 - (move_target >> 3));
            console.log(start_pos, end_pos, res - start_res);
        }

        // Reset state
        BOARD = cb;
        CASTLE = copy_castle;
        EN_PASSANT_SQUARE = copy_en;
        TURN = copy_turn;
    }
    return res;
}

function time_perft(depth) {
    let s = performance.now();
    perft(depth, 1);
    console.log("PERFT TIME", performance.now() - s);
}

// CONSTANTS -----------------------------------------------------------------------------------------------------------------------------------------------

function reset_search_tables() {
    // Killer moves - moves that cause snip in earlier iteration, check sooner
    killer_moves = [new Array(MAX_PLY), new Array(MAX_PLY)]; // id, ply

    // History moves
    history_moves = new Array(12); // piece, square
    for (let i = 0; i < 12; i++) { history_moves[i] = new Array(64).fill(0); }

    pv_length = new Array(MAX_PLY); // ply
    pv_table = new Array(MAX_PLY); // ply, ply
    for (let i = 0; i < MAX_PLY; i++) { pv_table[i] = new Array(MAX_PLY); }
}

let piece_values = [
    // opening material score
    82, 337, 365, 477, 1025, 0,
    
    // endgame material score
    94, 281, 297, 512, 936, 0
];

let piece_position_values = [
    //pawn
    [
        0,   0,   0,   0,   0,   0,  0,   0,
        98, 134,  61,  95,  68, 126, 34, -11,
        -6,   7,  26,  31,  65,  56, 25, -20,
        -14,  13,   6,  21,  23,  12, 17, -23,
        -27,  -2,  -5,  12,  17,   6, 10, -25,
        -26,  -4,  -4, -10,   3,   3, 33, -12,
        -35,  -1, -20, -23, -15,  24, 38, -22,
        0,   0,   0,   0,   0,   0,  0,   0,
    ],
    
    // knight
    [
        -167, -89, -34, -49,  61, -97, -15, -107,
        -73, -41,  72,  36,  23,  62,   7,  -17,
        -47,  60,  37,  65,  84, 129,  73,   44,
        -9,  17,  19,  53,  37,  69,  18,   22,
        -13,   4,  16,  13,  28,  19,  21,   -8,
        -23,  -9,  12,  10,  19,  17,  25,  -16,
        -29, -53, -12,  -3,  -1,  18, -14,  -19,
        -105, -21, -58, -33, -17, -28, -19,  -23,
    ],
    
    // bishop
    [
        -29,   4, -82, -37, -25, -42,   7,  -8,
        -26,  16, -18, -13,  30,  59,  18, -47,
        -16,  37,  43,  40,  35,  50,  37,  -2,
        -4,   5,  19,  50,  37,  37,   7,  -2,
        -6,  13,  13,  26,  34,  12,  10,   4,
        0,  15,  15,  15,  14,  27,  18,  10,
        4,  15,  16,   0,   7,  21,  33,   1,
        -33,  -3, -14, -21, -13, -12, -39, -21,
    ],

    // rook
    [
        32,  42,  32,  51, 63,  9,  31,  43,
        27,  32,  58,  62, 80, 67,  26,  44,
        -5,  19,  26,  36, 17, 45,  61,  16,
        -24, -11,   7,  26, 24, 35,  -8, -20,
        -36, -26, -12,  -1,  9, -7,   6, -23,
        -45, -25, -16, -17,  3,  0,  -5, -33,
        -44, -16, -20,  -9, -1, 11,  -6, -71,
        -19, -13,   1,  17, 16,  7, -37, -26,
    ],
            
    // queen
    [
        -28,   0,  29,  12,  59,  44,  43,  45,
        -24, -39,  -5,   1, -16,  57,  28,  54,
        -13, -17,   7,   8,  29,  56,  47,  57,
        -27, -27, -16, -16,  -1,  17,  -2,   1,
        -9, -26,  -9, -10,  -2,  -4,   3,  -3,
        -14,   2, -11,  -2,  -5,   2,  14,   5,
        -35,  -8,  11,   2,   8,  15,  -3,   1,
        -1, -18,  -9,  10, -15, -25, -31, -50,
    ],
    
    // king
    [
        -65,  23,  16, -15, -56, -34,   2,  13,
        29,  -1, -20,  -7,  -8,  -4, -38, -29,
        -9,  24,   2, -16, -20,   6,  22, -22,
        -17, -20, -12, -27, -30, -25, -14, -36,
        -49,  -1, -27, -39, -46, -44, -33, -51,
        -14, -14, -22, -46, -44, -30, -15, -27,
        1,   7,  -8, -64, -43, -16,   9,   8,
        -15,  36,  12, -54,   8, -28,  24,  14,
    ],


    // Endgame positional piece scores //

    //pawn
    [
        0,   0,   0,   0,   0,   0,   0,   0,
        178, 173, 158, 134, 147, 132, 165, 187,
        94, 100,  85,  67,  56,  53,  82,  84,
        32,  24,  13,   5,  -2,   4,  17,  17,
        13,   9,  -3,  -7,  -7,  -8,   3,  -1,
        4,   7,  -6,   1,   0,  -5,  -1,  -8,
        13,   8,   8,  10,  13,   0,   2,  -7,
        0,   0,   0,   0,   0,   0,   0,   0,
    ],
    
    // knight
    [
        -58, -38, -13, -28, -31, -27, -63, -99,
        -25,  -8, -25,  -2,  -9, -25, -24, -52,
        -24, -20,  10,   9,  -1,  -9, -19, -41,
        -17,   3,  22,  22,  22,  11,   8, -18,
        -18,  -6,  16,  25,  16,  17,   4, -18,
        -23,  -3,  -1,  15,  10,  -3, -20, -22,
        -42, -20, -10,  -5,  -2, -20, -23, -44,
        -29, -51, -23, -15, -22, -18, -50, -64,
    ],
    
    // bishop
    [
        -14, -21, -11,  -8, -7,  -9, -17, -24,
        -8,  -4,   7, -12, -3, -13,  -4, -14,
        2,  -8,   0,  -1, -2,   6,   0,   4,
        -3,   9,  12,   9, 14,  10,   3,   2,
        -6,   3,  13,  19,  7,  10,  -3,  -9,
        -12,  -3,   8,  10, 13,   3,  -7, -15,
        -14, -18,  -7,  -1,  4,  -9, -15, -27,
        -23,  -9, -23,  -5, -9, -16,  -5, -17,
    ],

    // rook
    [
        13, 10, 18, 15, 12,  12,   8,   5,
        11, 13, 13, 11, -3,   3,   8,   3,
        7,  7,  7,  5,  4,  -3,  -5,  -3,
        4,  3, 13,  1,  2,   1,  -1,   2,
        3,  5,  8,  4, -5,  -6,  -8, -11,
        -4,  0, -5, -1, -7, -12,  -8, -16,
        -6, -6,  0,  2, -9,  -9, -11,  -3,
        -9,  2,  3, -1, -5, -13,   4, -20,
    ],
            
    // queen
    [
        -9,  22,  22,  27,  27,  19,  10,  20,
        -17,  20,  32,  41,  58,  25,  30,   0,
        -20,   6,   9,  49,  47,  35,  19,   9,
        3,  22,  24,  45,  57,  40,  57,  36,
        -18,  28,  19,  47,  31,  34,  39,  23,
        -16, -27,  15,   6,   9,  17,  10,   5,
        -22, -23, -30, -16, -16, -23, -36, -32,
        -33, -28, -22, -43,  -5, -32, -20, -41,
    ],
    
    // king
    [
        -74, -35, -18, -18, -11,  15,   4, -17,
        -12,  17,  14,  17,  17,  38,  23,  11,
        10,  17,  23,  15,  20,  45,  44,  13,
        -8,  22,  24,  27,  26,  33,  26,   3,
        -18,  -4,  21,  24,  27,  23,   9, -11,
        -19,  -3,  11,  21,  23,  16,   7,  -9,
        -27, -11,   4,  13,  14,   4,  -5, -17,
        -53, -34, -21, -11, -28, -14, -24, -43
    ]
];

// BOOK -----------------------------------------------------------------------------------------------------------------------------------------------

// Accepted list of openings
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
    "1. e4 c6 2. c4",
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
        i += 1
    }
    while (i < game.length) {
        if (game[i] == " ") { break; }
        move += game[i];
        i++;
    }
    return create_move_san(move);
}

// EVALUATE -----------------------------------------------------------------------------------------------------------------------------------------------

function get_gamephase_score() {
    let res = 0;
    for (let i = 1; i < 5; i++) {
        res += count_bits(BOARD[i]) * piece_values[i];
        res += count_bits(BOARD[i + 6]) * piece_values[i];
    }
    return res;
}

function piece_val_map(piece, pos, opening) {
    if (piece >= 6) {
        piece -= 6;
        pos += (7 - (pos >> 3 << 1)) << 3; // flip rows
    }
    if (!PLAYER_WHITE) {
        pos += 7 - (pos % 8 << 1); // flip cols
    }
    if (opening) { return piece_values[piece] + piece_position_values[piece][pos]; }
    return piece_values[piece + 6] + piece_position_values[piece + 6][pos]; 
}

function evaluate_board() { // LOWER BOUND
    let opening_res = 0;
    let endgame_res = 0;
    for (let piece = 0; piece < 6; piece++) {
        let theboard = copy_bitboard(BOARD[piece]);
        while (bool_bitboard(theboard)) {
            let index = pop_lsb_index(theboard);
            opening_res += piece_val_map(piece, index, 1);
            endgame_res += piece_val_map(piece, index, 0);
        }
        theboard = copy_bitboard(BOARD[piece + 6]);
        while (bool_bitboard(theboard)) {
            let index = pop_lsb_index(theboard);
            opening_res -= piece_val_map(piece + 6, index, 1);
            endgame_res -= piece_val_map(piece + 6, index, 0);
        }
    }

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

function score_move(move, attackers) { // IMPORTANT
    if (score_pv && move == pv_table[0][ply]) {
        score_pv = 0;
        return 20000; // was determined best move in prev search
    }

    let target = get_move_target(move); 
    let piece = get_move_piece(move);
    let piece_type = piece % 6;

    if (get_move_capture(move)) {
        for (let i = 6 * (1 - TURN); i < 6 * (1 - TURN) + 6; i++) {
            if (get_bit(BOARD[i], target)) {
                return 10050 - 10 * piece_type + 100 * (i % 6 + 1) + (attackers[target] > 1);
                // return 10005 - piece_type + 100 * (i %  6 + 1);
            }
        }
        // En passant
        return 10105;
    }
    if (move == killer_moves[0][ply]) { return 9000; }
    if (move == killer_moves[1][ply]) { return 8000; }
    return Math.min(7000, history_moves[piece][target]); 
}

function order_moves(moves) {
    let res = [];
    let attackers = new Array(64).fill(0);
    for (let i = 0; i < moves.length; i++) {
        if (get_move_capture(moves[i])) {
            attackers[get_move_target(moves[i])]++;
        }
    }

    for (let i = 0; i < moves.length; i++) {
        let entry = [score_move(moves[i], attackers), moves[i]];
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
            follow_pv = 1; score_pv = 1;
            break;
        }
    }
}

// SEARCH -----------------------------------------------------------------------------------------------------------------------------------------------

function best_eval_captures(alpha, beta, depth) {
    COUNT++;

    let stand_pat = evaluate_board();
    if (ply >= MAX_PLY || depth == 0) {
        return stand_pat;
    } else if (stand_pat >= beta) { // beta cutoff
        return beta;
    } else if (stand_pat < alpha - 900) { // delta pruning
        return alpha;
    } else if (stand_pat > alpha) {
        alpha = stand_pat;
    } 

    let moves = order_moves(generate_capture_moves());
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
        let eval = -best_eval_captures(-beta, -alpha, depth - 1);
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

function best_eval(depth, alpha, beta) {
    pv_length[ply] = ply;
    if (ply && is_repetition()) { return 0; } 

    let score = HASH_TABLE.get(depth, alpha, beta);
    if (ply && score != null) {
        LOOKUP++;
        return score;
    }

    if (depth == 0) { return best_eval_captures(alpha, beta, 8); }
    if (ply >= MAX_PLY) { return evaluate_board(); }

    COUNT++;
    let moves = generate_pseudo_moves();

    // Follow pv line
    if (follow_pv) {
        enable_pv_scoring(moves);
    }

    moves = order_moves(moves);
    let legal_moves = 0; let hash_flag = 2;
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

        GAME.push(copy_board(BOARD));
        GAME_HASH.push(copy_bitboard(hash_key));
        
        legal_moves++;
        ply++
        let eval = -best_eval(depth - 1, -beta, -alpha);
        ply--;

        GAME.pop();
        GAME_HASH.pop();

        // Reset state
        BOARD = cb;
        CASTLE = cc;
        EN_PASSANT_SQUARE = copy_en;
        TURN = copy_turn;
        hash_key = copy_hash;
        
        if (eval > alpha) {
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

            if (eval >= beta) { // Opponent response too stong, snip this move
                HASH_TABLE.set(depth, 3, eval);
                if (!get_move_capture(move)) {
                    killer_moves[1][ply] = killer_moves[0][ply];
                    killer_moves[0][ply] = move;
                }
                return beta;
            }
        }        
    }
    
    if (!legal_moves) {
        let king_pos = lsb_index(BOARD[6 * TURN + 5]);

        if (is_square_attacked(king_pos, TURN ^ 1)) {
            return -100000 + ply;
        }
        return 0;
    }
    HASH_TABLE.set(depth, hash_flag, alpha);
    return alpha;
}

function search(depth) {
    reset_search_tables();
    COUNT = 0; LOOKUP = 0; ply = 0;
    follow_pv = 0; score_pv = 0;

    let move = book_move();
    if (move) {
        console.log("Book");
        pv_table[0][0] = move;
        return [0, 0];
    } 

    console.log("Lookahead:", depth);
    let eval = 0; let start = performance.now(); 
    for (let current_depth = 1; current_depth <= depth; current_depth++) {
        follow_pv = 1;

        eval = best_eval(current_depth, -Infinity, Infinity);

        let res = "Depth: " + (current_depth) + ", analysed: " + (COUNT) + ", eval: " + (eval) + ", PV: ";
        for (let i = 0; i < pv_length[0]; i++) {
            res += get_move_san(pv_table[0][i]) + " ";
        }
        console.log(res);
        if (Math.abs(eval) > 99900) { break; }
    } 
    if (TURN && PLAYER_WHITE) {
        eval *= -1;
    }
    let end = Math.round(performance.now() - start);
    if (pv_table[0][0]) {
        console.log("Best move: " + (get_move_san(pv_table[0][0])) + ", eval: " + (eval) + ", time (ms): " + (end));
    }
    console.log(" ");
    return [eval, end];
}

// MAIN -----------------------------------------------------------------------------------------------------------------------------------------------

let opening_phase = 6192;
let endgame_phase = 518;

let ply = 0;
let MAX_PLY = 64;
let MAX_TIME = 10 * 1000;

let killer_moves;; // id, ply
let history_moves;; // piece, square
let pv_length; // ply
let pv_table; // ply, ply
let follow_pv; let score_pv;

let hash_key;
let ZOB_TABLE;
let HASH_TABLE;
let HASH_SIZE = 67108864;

let COUNT = 0;
let LOOKUP = 0;