function perft(depth, print=1) {
    if (depth == 0) { return 1; }
    
    let res = 0;
    let moves = generate_pseudo_moves();
    for (let i = 0; i < moves.length; i++) {
        let move = moves[i];

        // Copy state
        let copy_board = copy_board(BOARD);
        let copy_castle = copy_castle(CASTLE);
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
            let start_pos = letters[move_source % 8] + (8 - (move_source  << 3));
            let end_pos = letters[move_target % 8] + (8 - (move_target << 3));
            console.log(start_pos, end_pos, res - start_res);
        }

        // Reset state
        BOARD = copy_board;
        CASTLE = copy_castle;
        EN_PASSANT_SQUARE = copy_en;
        TURN = copy_turn;
    }
    return res;
}

// CONSTANTS -----------------------------------------------------------------------------------------------------------------------------------------------

function initialise_ai_constants() {
    initialise_masks();
    init_zobrist();
    HASH_TABLE = new HashTable();
}

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

function set_row_col_mask(row, col) {
    let res = [0, 0];
    if (row > 0) {
        for (let i = 0; i < 8; i++) {
            set_bit(res, 8 * row + i);
        }
    } 
    if (col > 0) {
        for (let i = 0; i < 8; i++) {
            set_bit(res, col + 8 * i);
        }
    } 
    return res;
}

function initialise_masks() {
    row_masks = new Array(64); col_masks = new Array(64);
    isolated_masks = new Array(64); 
    player_passed_masks = new Array(64); ai_passed_masks = new Array(64);
    for (let s = 0; s < 64; s++) {
        row_masks[s] = [0, 0];
        col_masks[s] = [0, 0];
        isolated_masks[s] = [0, 0];
        player_passed_masks[s] = [0, 0];
        ai_passed_masks[s] = [0, 0];
    }
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            let square = 8 * i + j;

            row_masks[square] = or_bitboards(row_masks[square], set_row_col_mask(i, -1));
            col_masks[square] = or_bitboards(col_masks[square], set_row_col_mask(-1, j));

            isolated_masks[square] = or_bitboards(isolated_masks[square], set_row_col_mask(-1, j - 1));
            isolated_masks[square] = or_bitboards(isolated_masks[square], set_row_col_mask(-1, j + 1));

            player_passed_masks[square] = or_bitboards(player_passed_masks[square], set_row_col_mask(-1, j - 1));
            player_passed_masks[square] = or_bitboards(player_passed_masks[square], set_row_col_mask(-1, j));
            player_passed_masks[square] = or_bitboards(player_passed_masks[square], set_row_col_mask(-1, j + 1));

            ai_passed_masks[square] = or_bitboards(ai_passed_masks[square], set_row_col_mask(-1, j - 1));
            ai_passed_masks[square] = or_bitboards(ai_passed_masks[square], set_row_col_mask(-1, j));
            ai_passed_masks[square] = or_bitboards(ai_passed_masks[square], set_row_col_mask(-1, j + 1));

            for (let k = 7; k >= i; k--) { // loop over redundant ranks
                for (let l = Math.max(0, j - 1); l <= Math.min(8, j + 1); l++) {
                    pop_bit(player_passed_masks[square], 8 * k + l);
                }
            }
            for (let k = 0; k <= i; k++) { // loop over redundant ranks
                for (let l = Math.max(0, j - 1); l <= Math.min(8, j + 1); l++) {
                    pop_bit(ai_passed_masks[square], 8 * k + l);
                }
            }
        }
    }
}

let piece_values = [
    // opening material score
    82, 337, 365, 477, 1025, 0,
    
    // endgame material score
    94, 281, 297, 512, 936, 0
];

let m = [
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

let book_games = [
    // GM games
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nc3 6. Bd3 g6 7. f3 Bg7 8. Be3 Nc6 9. Qd2 Nxd4 10. Bxd4 Be6 11. g4 h4 13. a3 h6 14. O-O-O 15. 5 Nh5 16. Bxg7 Nxg7 17. gxh6 Nh5 18. Qg5 Qxg6+ 20. Qg1 b4 21. axb4 Qxb4 22. Kd2 Nf4 23. Qe3 Qxd3 25. Qxa6 Kf8 26. Ra1 d5 27. Ra4 Qc5 28. exd5 Qa7 30. Qe3 Rg6 31. Ra8+ Kg7 32. Kc1 Qb4 33. Ra4 Nxb1 35. Qxe7 Rg2 36. Qe4 Qa7 37. Re1 Rg1 38. Nc3 Kd2 40. Re2 Rg1 41. Qe7 Rd1+ ",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. d3 Bc5 5. Bxc6 dxc6 6. O-O",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Be7 5. O-O 6. h3 d6 7. a4 a5",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. c3 d6 6. O-O 7. Re1 a5 8. Bg5 h6 9. Bh4 g5 10. Bg3 Nh7 11. d4 Bb6 12. dxe5 h5 13. h4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O 5. Re1 Nd6 6. Nxe5 Be7 7. Bf1 Nxe5 8. xe5 O-O 9. d4 Bf6 10. Re1 Re8 11. Bf4 Qxe1 13. c3 d5 14. Bd3 c6 15. Nd2 g6 16. Qe2 Ng7 17. Re1 Bf5 18. Nf3 Qxd3 20. a3 Re8 21. Rxe8+ Nxe8 22. Qe2 Qd8 23. g3 Kg2 25. Bb8 a6 26. Be5 Bxe5 27. xe5+ f6 28. Qe2 Kf7 29. Ne1 Nd6 30. Nd3 a4 32. f3 Qe6 33. Kf2 Qh3 34. g1 Qe6 35. Kf2 Qh3 36. Kg1 Qe6 37. Kf2  ",
    "1. d4 d5 2. Nf3 Nf6 3. c4 e6 4. g3 Bb4+ 5. Bd2 Be7 6. Bg2 O-O 7. O-O 8. c2 c6 9. Rc1 b6 10. cxd5 cxd5 11. Qd1 Bb7 12. a3 a6 13. f4 Rc8",
    "1. d4 Nf6 2. c4 g6 3. f3 c5 4. d5 d6 5. e4 e6 6. Nc3 exd5 7. cxd5 Bg7 8. ge2",
    // "1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. Nc3 Be7 5. Bf4 O-O 6. e3 c5 7. dxc5 Bxc5 8. c2 Nc6 9. a3 Qa5 10. Rd1 Rd8 11. Be2 cxd5 13. bxc3 exd5 14. O-O 15. a4 Bd6 16. Bxd6 c4 18. c5 Rdd8 19. Rb1 Qc7 20. b2 Rab8 21. Nd4 Nxd4 22. Qxd4 b6 23. cxb6 h3 25. Rfd1 Qc3 26. Qxc3 Rxc3 27. a5 Rxb1 28. Rxb1 a6 30. Rb7 Rc1+ 31. Kh2 Rc2 32. b5 Rb2 33. Kg3 Bc8 34. Rb8 Kg7 35. Rxc8 Rc7 37. Rxa7 Kf6 38. Ra8 Ra3 39. Kh2 h5 40. a7 h4 42. f3 Ra1 43. g3  ",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O 7. a4 h6 8. Re1 O-O 9. h3 a5 10. d4 Ba7 11. Bb3 Re8 12. Bc2 Bd7 13. Na3 Nb5 15. Bb1 exd4 16. cxd4 Nb4 17. Ra3 Re7 18. e5 dxe5 19. dxe5 Nfd5 20. Nh4 Qe8 21. Qe2 Nc6 22. f3 Rd8 23. Kh2 f5 24. g4 fxg4 25. Qd3 Qxd5+ 27. Qe4 gxf3 28. Rg1 Bf7 29. Ba2 Bxa2 30. Rxg6+ Qxg6 31. Qxg6+ Rg7 32. Qxg7+ Kxg7 33. Rxa2 Rd1 34. Ra1 Kf7 ",
    // "1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. Nc3 Bb4 5. Bg5 h6 6. Bxf6 Qxf6 7. e3 O-O 8. a3 Bxc3+ 9. bxc3 c5 10. g4 cxd4 11. cxd4 Bxc4 13. g5 hxg5 14. Rg1 Ba6 15. xa6 Nxa6 16. Nxg5 Qf5 17. e4 Qa5+ 18. Kf1 Ke1 20. Kf1 Qb5+ 21. Ke1 Qa5+ 22. Kf1  ",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. e5 d5 7. Bb5 Ne4 8. xd4 Bb6 9. Nc3 O-O 10. Be3 Ba5 11. Qb3 bxc3 13. Qb4 b6 14. O-O 15. Rfc1 Rc8 16. Ba6 Bd3 18. h3 c6 19. Bf4 Rb7 20. b2 b5 21. Qe2 Nc4 22. Ng5 Nxg5 23. Bxf5 Ne6 24. Bg3 b4 25. g4 Qb8 26. h4 a5 27. h5 Qa7 28. Rab1 Rb2 30. Rb3 Nd2 31. Rb2 Nc4 32. b3 Nd2 ",
    "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nc3",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O 6. Re1 b5 7. Bb3 O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 11. Rxe5 c6 12. d3 Bd6 13. e1 Bf5 14. Qf3 Qh4 15. g3 Qh3 16. Nd2 Ne4 18. Qg2 Qxg2+ 19. Kxg2 f5 20. h3 Bh5 21. Bf4 gxf4 23. dxe4 Bf3+ 24. Kxf3 Rxf4+ 25. Kg3 Rfxe4 26. Rxe4 Rxe4 27. f3 Re2 28. 4 bxc4 29. Bxc4 Rxb2 30. Bxa6 g5 31. Bc4 Bxd5 33. a4 h5 34. h4 Kg6 35. a5 Rb7 36. a6 Ra7 37. hxg5 Kxg5 38. Ra5 h4+ 39. Kh3 Kf4 40. xd5 Rxa6 41. Kxh4 Rh6+ 42. Rh5 Rxh5+ 43. Kxh5 Kxf3 ",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O 5. d3 d6 6. c3 a6 7. a4 Ba7 8. Na3 Ne7 9. Nc2 Ng6 10. Be3 Bxe3 11. Nxe3 O-O 12. Qc2 c6 13. 5 d5 14. Bb3 Be6 15. exd5 cxd5 16. d4 Ne5 18. f4 exf3 19. Nxf3 Rae8 20. Rfe1 Bd7 21. g3 h6 22. Qg2 Re7 23. Nc2 Nb4 25. Rxe7 Rxe7 26. Bd1 h5 27. Qh3 Bd7 28. Qg2 Qh3 30. Bc2 hxg3 31. Qxg3 Nf4 32. Kh1 Re3 33. Rg1 g6 34. Qf2 Re2 35. Qh4 Bxe4 37. Ne5 Nd3 38. Qh8+ Kxh8 39. Nxf7+ Kh7 40. Nxd6 Bd7 41. Nxe4 Bf5 42. g5+ Kh6 43. Nxd3 Bxd3 44. Rg3 Re1+ 45. Kg2 Kg1 47. Kf2 Re2+ 48. Kf3 Rxb2 49. Kf4 Bf5 50. Ke5 Nf7+ 52. Nd6 Re2+ 53. Kd5 Kf6 54. c4 Re7 55. Rf3 c5 57. Rf2 Rh7 58. Nxf5 gxf5 59. Kd6 Rh8 60. Rd2 f4 61. Kc7 Rh7+ 62. Kc8 d5 ",
    // "1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. Nc3 Be7 5. cxd5 exd5 6. Qc2 c6 7. e3 Nbd7 8. Bd3 O-O 9. g4 Bb4 10. Bd2 Qe7 11. Rg1 Bxc3 12. Bxc3 Ne4 13. g5 a5 14. a4 Re8 15. h4 b6 16. h5 Ba6 17. Bxe4 dxe4 18. Nh4 Qe6 19. Rg3 Bd3 20. Qd1 b5 21. axb5 cxb5 22. g2 b4 23. Nf4 Qf5 24. Bd2 Nb6 25. g6 hxg6 27. Qg4 Qxg4 28. Rxg4 Nc4 29. Nxd3 exd3 30. d5 Rg3 32. Rg4 Ne5 33. Rg3 Nc4 34. g4  ",
    "1. Nf3 d5 2. g3 g6 3. Bg2 Bg7 4. d4 Nf6 5. c4 c6 6. cxd5 cxd5 7. Ne5 Ne4 8. c3 Nxc3 9. bxc3 O-O 10. O-O 11. Nxc6 Qa4 13. e4 Qa6 14. Qb4 dxe4 15. xe4 e5 16. dxe5 Bxe5 17. Be3 Be6 18. Qc5 Rfd1 20. Rxd8 Rxd8 21. h4 Qc4 22. Qxc4 Bxc4 23. Bxa7 Bxc3 24. Rc1 Bd4 25. xd4 Rxd4 26. Bxc6 Bxa2 27. Kg2 Bd5+ 28. Bxd5 Rxd5 29. Rh1 h5 30. g1 Kg7 31. Rh1 Kg8 32. Rg1 Kg7 ",
    // "1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. Nc3 Be7 5. Bf4 O-O 6. e3",
    "1. Nf3 Nf6 2. c4 e6 3. g3 d5 4. Bg2 Be7 5. d4 O-O 6. O-O 7. Qc2 c6 8. xc4 b5 9. Qc2 Bb7 10. Bg5",
    "1. c4 e6 2. Nc3 d5 3. d4 c5 4. e3 Nf6 5. Nf3 a6 6. cxd5 exd5 7. g3 Nc6 8. g2 c4 9. Ne5 Bb4 10. Bd2 O-O 11. O-O 12. Nxc6 bxc6 13. b3 a5 14. Qc2 cxb3 15. axb3 g6 16. Rfc1 Qd1 18. Ra2 h5 19. Na4 h4 20. c5 Kg7 21. Bxb4 axb4 22. Rxa8 Rxa8 23. Ra1 Rh8 24. Qe1 hxg3 25. xg3 Ne4 26. Nxe4 Bxe4 27. Bxe4 dxe4 28. Ra5 Rh5 29. Rxh5 gxh5 30. Kg2 c5 31. dxc5 Qxc5 32. Qd1 Qc3 33. Qd5 Kf6 34. Qd6+ Kg7 35. d5 Kf6 36. Qd6+ Kg7 37. Qd5 Kf6 ",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. d3 Bc5 5. c3 O-O",
    "1. d4 Nf6 2. Nf3 d5 3. c4 e6 4. Nc3 c6 5. e3",
    // "1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. Nc3 Bb4 5. cxd5 exd5 6. Bg5 h6 7. Bh4 O-O 8. e3 Bf5 9. Be2",
    "1. d4 d5 2. c4 dxc4 3. e4 e5 4. Nf3 exd4 5. Bxc4 Nc6 6. O-O",
    "1. d4 Nf6 2. c4 g6 3. g3 c6 4. Bg2 d5 5. cxd5 cxd5 6. Nf3 Bg7 7. Ne5 O-O 8. c3 Bf5 9. O-O 10. Bf4 Nxc3 11. bxc3 Nc6 12. Nxc6 bxc6 13. Qa4 e6 14. Qxc6 Rc8 15. Qa4 Rxc3 16. Rfc1 Rxc1+ 17. Rxc1 Qb6 18. e3 Qb2 19. Qd1 h5 20. a4 Bg4 21. Qe1 Bf1 23. Kxf1 Re8 24. Qc3 Qxc3 25. Rxc3 e5 26. dxe5 Rd3 28. gxf4 Rd8 29. a5 Kf8 30. Ke2 Ke7 31. Rb3 Kd3 33. h4 Rc7 34. Rb8 Rc5 35. b7 Rxa5 36. Rxf7 Ra3+ 37. Kd4 Ra4+ 38. Kd3 Kd4 ",
    // "1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. Nc3 Be7 5. Bf4 O-O 6. e3 c5 7. dxc5 Bxc5 8. c2 Nc6 9. Rd1 Qa5 10. a3 Rd8 11. Nd2 Nb3 13. Na4 Bb4+ 14. axb4 Qxb4+ 15. Nd2 e5 16. Bg5 Qa5 17. Qb3 Nb4 18. Bxf6 Be2 20. Ra1 dxe3 21. fxe3 b5 22. O-O 23. Qc3 Nf3 25. Nh4 Nc6 26. Qa3 e4 27. d1 Ne5 28. Bxa4 Qxa4 29. Qxa4 Bxa4 30. Rxa4 f4 31. c5 fxe3 32. xe4 Rab8 33. Rxe3 Rxb2 34. h3 Rc2 35. Rxf6 Ra6 37. Nf3 Rc8 38. Re6 Rc7 39. Kh2 Kg7 40. Ra4 Ra6 42. Nd4 Nf5 43. Ne2 Rc4 44. g6+ Kf8 45. Rg5 Ng7 46. Rf6+ Rf7 47. Rh6 Ra5 49. Rh8+ Rf8 50. Rh7 Rf7 51. Re5+ Kd8 52. Rexh5  ",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Bb7 10. d4 Re8 11. Ng5 Rf8 12. Nf3 Re8",
    // "1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. Bg5 Qa4+ 6. e4 Be7 7. Nc3 O-O 8. xc4 Nb6 9. Qb3 Nxc4 10. Qxc4 a6 11. O-O 12. Qe2 Bb7 13. Bxf6 Bxf6 14. Rfd1 Qe8 15. Qe3 e5 16. dxe5 Bxe5 17. Nxe5 Qxe5 18. f3 Rad8 19. Rxd8 Rxd8 20. Rd1 Rxd1+ 21. Nxd1 h6 22. Qc3 Qxc3 23. Nxc3 c5 24. a3 Kf8 25. b4 Ke7 26. Kf2 Kd6 27. Ke3 Bc8 28. f4 e5+ 30. h3 h5 31. Ne4 cxb4 32. xb4 Kd5 33. Nd6 h4 34. Ne8 g6 35. Nc7+ Nxe6 37. g4 hxg3 38. h4 Kd5 39. Kf3 Kc6 40. Kxg3 bxa5 42. h5 gxh5 43. f5 b3 44. 6 b2 45. f7 b1Q 46. f8Q Qg1+ 47. Kh3 Kh2 49. Kh3 Qxe5 50. Qb4 Qb5 51. Qe4+ Qd5 52. Qb4 Qe4+ 54. Qb4 Qb5 ",
    "1. c4 Nf6 2. Nf3 e6 3. g3 d5 4. Bg2 dxc4 5. Qa4+",
    "1. c4 e5 2. Nc3 Nf6 3. Nf3 Nc6 4. g3 d5 5. cxd5 Nxd5 6. Bg2 Bc5 7. O-O 8. d3 h6 9. Nxd5 Qxd5 10. a3 a5 11. Bd2 Rc1 13. Bc3 Nd4 14. e3 Nxf3+ 15. xf3 Bd6 16. Qh5 c6 17. f4 exf4 18. gxf4 Kh1 20. Rce1 Qc5 21. f5 Bf8 22. Be4 Rd5 23. Rf3 Rg1 25. Bf6 g6 26. Qh3 Rd6 27. h4 Rxf6 28. Qxf6 Be7 29. Qxc6 Qxc6 30. Bxc6 Kg7 31. fxg6 fxg6 32. d4 a4 33. d5 b4 34. Be8 Bg5 35. h4 Rxg6+ 37. Rc6 Bg4 38. Rf4 Rg7 ",
    "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nxc6 6. e5 Qe7 7. Qe2 Nd5 8. c4 Nb6 9. Nc3 a5 10. Bd2 g6 11. Ne4 Bg7 12. Nf6+ Kd8 13. O-O-O 14. Qg4 Kc8 15. xa5 h5 16. Qg3 h4 17. Qg4 Qxe5 18. Bc3 Qxf5 20. Nxd7 Bxc3 21. Nxb6+ cxb6 22. bxc3 Kc7 23. Be2 Rhg1 25. g3 hxg3 26. hxg3 Rh2 27. Rgf1 f4 28. Rd2 Bc8 29. Bf3 fxg3 30. fxg3 Rxd2 31. Kxd2 Rxg3 32. Bd5 Be6 33. Bxe6 fxe6 34. Rf7+ Kd6 35. Rb7 Kc6 36. Re7 Kd6 37. b7 Kc6 38. Re7 Kd6 ",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. d3 Bc5 5. c3 d5",
    // "1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. Nc3 Be7 5. Bf4 O-O 6. e3 c5 7. dxc5 Bxc5 8. xd5 Nxd5 9. Nxd5 exd5 10. Bd3 Bb4+ 11. Nd2 Qc2 13. O-O 14. a3 Bd6 15. xd6 Qxd6 16. e4 Ne5 17. Nc4 Nxc4 18. Qxc4 Be6 19. Qb4 Qxb4 20. xb4 Rfc8 21. Rfc1 g5 22. Kf1 Rxc1+ 23. Rxc1 a5 24. b5 a4 25. Ke2 a3 26. bxa3 Rxa3 27. Rc7 Ra2+ 28. Ke1 Rc6 30. Kd2 Ra2+ 31. Ke1 Ra1+ 32. Kd2 Ra2+ 33. Ke1  ",
    "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nc3 6. Ndb5 d6 7. Nd5 Nxd5 8. xd5 Ne7 9. c4 Ng6 10. Qa4 Bd7 11. Qb4 Qa4 13. Qb4 Bf5 14. h4 h5 15. g5 Qb8 16. Be2 a6 17. Nc3 Qc7 18. g3 Be3 20. O-O 21. Bxh5 Ne5 22. e2 Qd7 23. Qa4 Qc8 24. c5 dxc5 25. Nxe4 Nc3 27. Qd1 b4 28. Na4 Be4 29. d4 Qf5 30. f4 Qg6 31. Bf2 Nd3 32. h5 Bg4 34. Qxe4 Bd6 35. Qg2 Rae8 36. Bd4 Qxh5 37. Qf3 Kh1 39. Bf2 Rfe8 ",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O 7. a4 Ba7 8. Re1 Ng4 9. Rf1 Nf6",
    // "1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. Nc3 Bb4 5. Bg5 h6 6. Bxf6 Qxf6 7. e3 O-O 8. c1 dxc4 9. Bxc4 c5 10. O-O 11. Nxd4 Bd7 12. Qb3 Nc6 13. xc6 Bxc3 14. Qxc3 Bxc6 15. Qxf6 gxf6 16. Rfd1 Rfd8 17. f3 f5 18. f2 Kg7 19. Be2 Kf6 20. Rxd8 Rxd8 21. Rd1 Rxd1 22. Bxd1 b6 23. 3 Bb5 24. Bc2 Bc6 25. Bd1 Bb5 26. Bc2  ",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. d3 Bc5 5. c3 O-O 6. O-O 7. Ba4 Ne7 8. Bc2 Ng6 9. d4 Bb6 10. a4 c6 11. dxe5 Nxe5 12. Nxe5 dxe5 13. Qxd8 Rxd8 14. a5 Bc5 15. d2 Be6 16. Re1 b5 17. Nb3 Bxb3 18. Bxb3 Ng4 19. Re2 Rd6 20. g5 Kf8 21. Rf1 Nf6 22. g3 a6 23. Kg2 Bc1 25. f4 f6 26. h4 Re8 27. h5 h6 28. Ba2 c5 29. Be3 exf4 30. gxf4 Rxe4 31. Bb1 Re7 32. Rfe1 f5 33. Bxf5 Nf6 34. f3 Nd5 35. Rd2 Rd8 36. Be4 Red7 37. Red1 Nf6 38. Rxd7 Nxd7 39. Rd6  ",
    // "1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. Nc3 Be7 5. Bf4 O-O 6. e3 c5 7. dxc5 Bxc5 8. 3 Nc6 9. Qc2 Qa5 10. Rd1 Rd8 11. Be2 cxd5 13. bxc3 exd5 14. O-O 15. a4 Bd6 16. Bxd6 c4 18. c5 Rd8 19. Rd2 Be6 20. b1 Rdc8 21. Nd4 Nxd4 22. exd4 Bd7 23. Bb5 Bd3 25. Bb5 Bf5 26. Bd3 Bd7 27. b5  ",
    "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 Nf6 5. O-O 6. c3 a6 7. b4 Ba7 8. a4 O-O",
    "1. e4 e5 2. f4 exf4 3. Bc4 d5 4. Bxd5 Qh4+ 5. Kf1 g5 6. Nc3 Ne7 7. d4 Bg7 8. Nf3 Qh5",
    "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nxc6 bxc6 6. Bd3 d5 7. exd5 cxd5 8. O-O Be7",
    "1. e4 e5 2. Nf3 d6 3. d4 Nd7 4. Bc4 c6 5. Ng5 Nh6 6. f4 Be7 7. O-O O-O 8. Nf3 exd4",
    "1. e4 e5 2. f4 exf4 3. Bc4 d5 4. Bxd5 Qh4+ 5. Kf1 g5 6.Nc3 Ne7 7.d4 Bg7 8. Nf3", 
    "1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Bc4 d5 7. exd5 Bd6 8. O-O ",
    "1. d4 d5 2. c4 Nf6 3. Nf3 e6 4. e3 Bd7 5. a3 c5 6. Nc3 Nc6 7. dxc5 Bxc5 8. b4 Bb6 ",
    "1. e4 c5 2. Nf3 Nc6 3. Bc4 e6 4. Nc3 Qc7 5. a3 a6 6. d3 Nf6 7. O-O b5 8. Ba2 Bb7 ",
    "1. e4 b6 2. d4 Bb7 3. Nc3 e6 4. Bd3 Nf6 5. Bg5 Be7 6. Nh3 d5 7. Bxf6 gxf6 8. Qg4 ",
    "1. d4 d5 2. c4 e6 3. Nc3 c5 4. e3 Nf6 5. Nf3 Nc6 6. a3 a6 7. dxc5 Bxc5 8. b4 Bd6 ",
    "1. d4 d5 2. Nf3 e6 3. e3 c6 4. Bd3 f5 5. Ne5 Qf6 6. Nd2 Nd7 7. f4 Nxe5 8. fxe5 Qf7",
    "1. e4 e5 2. Nf3 Nc6 3. c3 d5 4. Qa4 f6 5. Bb5 Ne7 6. exd5 Qxd5 7. O-O Bd7 8. d4 e4 ",
    "1. e4 e5 2. Nc3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. f4 d6 6. Nf3 Bg4 7. Na4 exf4 8. Nxc5 ",
    "1. e4 e5 2. f4 exf4 3. Bc4 d5 4. Bxd5 Qh4+ 5. Kf1 Nf6 6. Nf3 Qh6 7. Nc3",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Nxe4 6. Qe2 Nc5 7. Bxc6 dxc6 8. d4 ",
    "1. e4 e5 2. Nc3 Nf6 3. Bc4 Nc6 4. d3 Bb4 5. Ne2 d5 6. exd5 Nxd5 7. Bxd5 Qxd5 8. O-O Qd8",
    "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nxc6 bxc6 6. Bd3 d5 7. exd5 cxd5 8. O-O Be7 ",
    "1. d4 d5 2. Nf3 e6 3. e3 Nf6 4. Bd3",
    "1. e4 e5 2. Nf3 d6 3. d4 Nd7 4. Bc4 c6 5. dxe5 dxe5 6. Be3 Be7 7. Nc3 Qc7 8. a4 Nc5",
    "1. d4 d5 2. Nf3 Nf6 3. e3 e6 4. Bd3",
    "1. e4 e5 2. Nf3 d6 3. d4 Nd7 4. Bc4 c6 5. c3",
    "1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. exd5 exd5 5. Bg5 Be7 6. Bd3 Bg4",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. d3 d6 6. h3 g6 7. c4 Bg7 8. Be3 O-O",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 f5 4. Nc3 fxe4 5. Nxe4 d5 6. Nxe5 dxe4 7. Nxc6 Qg5 8. Nd4+ c6 ",
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O b5 6. Bb3 d6 7. Ng5 d5 8. exd5 Nd4",

    // Sicilian RANDOM
    "1. e4 c5 2. f4",
    "1. e4 c5 2. c3",
    "1. e4 c5 2. Nc3",
    "1. e4 c5 2. Nf3 a6",
    "1. e4 c5 2. Nf3 Nf6",
    "1. e4 c5 2. Nf3 Nc6 3. Bb5 g6",
    "1. e4 c5 2. Nf3 Nc6 3. d4",
    "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6",
    "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 g6 5. Nxc6",
    "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 a6",
    "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6",
    "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6 5. Nc3",
    "1. e4 c5 2. Nf3 d6 3. Bb5+",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Qxd4",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e6",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e6 6. Bc4",
    "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6",
    
    // Vienna GOTHAM
    "1. e4 e5 2. Nc3 Nc6 3. Bc4 Bc5 4. Qg4 Qf6 5. Nd5 Qxf2+ 6. Kd1 Kf8 7. Nh3 h5 8. Qg5 f6 9. Qg6",
    "1. e4 e5 2. Nc3 Nc6 3. Bc4 d6 4. d3",
    "1. e4 e5 2. Nc3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. f4 d6 6. Nf3 O-O 7. f5",
    "1. e4 e5 2. Nc3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. f4 d6 6. Nf3 Ng4 7. Ng5 O-O 8. f5 Bf2+ 9. Kf1 Ne3+ 10. Bxe3 Bxe3 11. h4 Bxg5 12. hxg5 Qxg5 13. Rh5 Qf4+ 14. Kg1",
    "1. e4 e5 2. Nc3 Nf6 3. f4 exf4 4. e5 Ng8 5. Nf3 d6 6. d4 dxe5 7. Qe2 Bb4 8. Qxe5+ Qe7 9. Bxf4",
    "1. e4 e5 2. Nc3 Nf6 3. f4 d6 4. Nf3 Nc6 5. Bb5 Bd7 6. d3",
    "1. e4 e5 2. Nc3 Nf6 3. f4 d5 4. fxe5 Nxe4 5. Qf3 f5 6. d3 Nxc3 7. bxc3 d4 8. Qg3 dxc3 9. Be2 Be6 10. Bf3 Nc6 11. Ne2 Qd7 12. Be3 Nb4 13. Rc1",
    "1. e4 e5 2. Nc3 Nf6 3. f4 d5 4. fxe5 Nxe4 5. Qf3 f5 6. d3 Nxc3 7. bxc3 Be6",
    "1. e4 e5 2. Nc3 Nf6 3. f4 d5 4. fxe5 Nxe4 5. Qf3 Nc6 6. Bb5 Nxc3 7. dxc3 Qh4+ 8. g3 Qe4+",
    "1. e4 e5 2. Nc3 Nf6 3. f4 d5 4. fxe5 Nxe4 5. Qf3 Nxc3 6. dxc3 Be6 7. Bf4 c5 8. O-O-O Nc6 9. Bc4",
    "1. e4 e5 2. Nc3 Nf6 3. f4 d5 4. fxe5 Nxe4 5. Qf3 Nxc3 6. bxc3 Be7 7. d4 O-O 8. Bd3 Be6 9. Ne2 c5 10. O-O Nc6 11. Be3 *",
    
    // Scandinavian GOTHAM
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 3. Nf3 Bg4 4. Be2 Nc6 5. O-O O-O-O 6. Nc3 Qd7 7. b4 Nf6 8. b5 Bxf3 9. Bxf3 Nd4 10. a4 Qf5",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 3. Nf3 Bg4 4. Be2 Nc6 5. d4 O-O-O)",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Nc6 4. d4",
    "1. e4 d5 2. exd5 Qxd5 3. d4 Nf6 4. Nc3",
    "1. e4 d5 2. exd5 Qxd5 3. c4 Qe4+ 4. Qe2 Qxe2+ 5. Bxe2 Nc6",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd8 4. d4 Nf6 5. Nf3 Bg4 6. Bc4 e6 7. O-O Nc6",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd6 4. d4 Nf6 5. Nf3 a6 6. Be2 Nc6 7. O-O Bf5 8. Be3 O-O-O",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. Bc4 Nf6 5. Nf3 Bg4 6. O-O e6",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. b4 Qxb4 5. Rb1 Qd6 6. d4 Nf6 7. g3 Nc6",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. Nf3 Nf6 5. Bc4 Bg4 6. O-O Nc6",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Bd2 c6 6. Nf3 Bg4 7. Bc4 e6 8. O-O Qc7 9. Re1 Be7",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 Bf5 6. Bc4 e6 7. Bd2 c6 8. O-O Qc7 9. Re1 Be7 10. Rc1 Nbd7",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 Bg4 6. h3 Bh5 7. g4 Bg6 8. Ne5 e6 9. h4",
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 Bg4 6. h3 Bh5 7. Be2 Nc6 8. O-O O-O-O 9. Be3 e5",

    // Caro Kann GOTHAM
    "1. e4 c6 2. d4 2. Nf3 d5 3. Nc3 Bg4 4. h3 Bxf3 5. Qxf3 e6",
    "1. e4 c6 2. d4 2. Nf3 d5 3. Nc3 a6 4. d4 Bg4",
    "1. e4 c6 2. Nf3 d5 3. Nc3 d4",
    "1. e4 c6 2. Nf3 d5 3. Nc3 dxe4",
    "1. e4 c6 2. Nf3 d5 3. Nc3 Nf6",
    "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nf6 5. Nxf6+ exf6 6. Nf3 Bd6 7. Bd3 O-O 8. O-O Re8 9. Be3",
    "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. h5 Bh7 8. Nf3 Nd7 9. Bd3 Bxd3 10. Qxd3 e6",
    "1. e4 c6 2. d4 d5 3. Nd2",
    "1. e4 c6 2. d4 d5 3. exd5 cxd5 4. Nf3 Nc6",
    "1. e4 c6 2. d4 d5 3. exd5 cxd5 4. Nf3 g6",
    "1. e4 c6 2. d4 d5 3. exd5 cxd5 4. Bd3 Nc6",
    "1. e4 c6 2. d4 d5 3. exd5 cxd5 4. c4 Nf6 5. Nc3 e6",
    "1. e4 c6 2. d4 d5 3. exd5 cxd5 4. c4 Nf6 5. Nc3 g6 6. Qb3 Bg7 7. cxd5 O-O",
    "1. e4 c6 2. d4 d5 3. f3 g6 4. Nc3 Bg7 5. Be3 Qb6",
    "1. e4 c6 2. d4 d5 3. f3 dxe4 4. fxe4",
    "1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 c5 6. O-O Nc6",
    "1. e4 c6 2. d4 d5 3. e5 Bf5 4. c4",
    "1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nc3",
    "1. e4 c6 2. d4 d5 3. e5 c5 4. c3",
    "1. e4 c6 2. d4 d5 3. e5 c5 4. dxc5 Nc6 5. Nf3 Bg4 6. Bf4 e6",
    "1. e4 c6 2. d4 d5 3. e5 c5 4. dxc5 e6 5. Be3",
    "1. e4 c6 2. d4 d5 3. e5 c5 4. Nf3",
    "1. e4 c6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Bg4 6. Be2 e6 7. O-O",

    // Alapin sicilian GOTHAM
    "1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. Nf3 Nf6 5. Na3 Nc6",
    "1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. Nf3 Nf6 5. Na3 e6 6. d4 cxd4 7. Nb5 Na6 8. Qxd4 Qxd4 9. Nfxd4 Be7",
    "1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. Nf3 Nf6 5. Na3 Bg4 6. Be2 Nc6 7. O-O e6 8. d4 (8. Qa4 Be7 9. Nc4 O-O",
    "1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. Nf3 Nf6 5. Na3 Bg4 6. Be2 Nc6 7. O-O e6 8. Qa4 Be7 9. Nc4 O-O",
    "1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. Nf3 Nf6 5. Na3 Nc6 6. Bc4 Qd8 7. O-O Bg4 8. Qb3",
    "1. e4 c5 2. c3 Nc6 3. d4 cxd4 4. cxd4 d5 5. exd5 Qxd5 6. Nf3 Bg4 7. Be2 O-O-O 8. Nc3 Qa5 9. Be3 e6",
    "1. e4 c5 2. c3 d6 3. d4 cxd4 4. cxd4 Nf6 5. Nc3 g6 6. Nf3 Bg7 7. Be2 O-O 8. O-O",
    "1. e4 c5 2. c3 g6 3. d4 cxd4 4. cxd4 d5 5. e5",
    "1. e4 c5 2. c3 Nf6 3. e5 Nd5 4. d4 e6 5. Nf3 cxd4 6. cxd4 d6 7. Bc4 Nc6 8. O-O Be7 9. Qe2",
    "1. e4 c5 2. c3 Nf6 3. e5 Nd5 4. d4 cxd4 5. Nf3 Nc6 6. Bc4 Nb6 7. Bb3 d5 8. exd6 Qxd6 9. O-O dxc3",
    "1. e4 c5 2. c3 Nf6 3. e5 Nd5 4. d4 cxd4 5. Nf3 Nc6 6. Bc4 Nb6 7. Bb3 d5 8. exd6 Qxd6 9. O-O Be6",

    // Nimzo
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5 5. a3 Bxc3+ 6. Qxc3 cxd4 7. Qxd4 Nc6",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5 5. dxc5 O-O 6. Nf3 Na6",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5 5. dxc5 O-O 6. a3 Bxc5 7. Nf3 Nc6 8. Bg5 Nd4",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 c5 5. Ne2 cxd4 6. exd4 d5 7. a3 Be7 8. Nf4 dxc4 9. Bxc4 O-O",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 c5 5. Ne2 cxd4 6. exd4 d5 7. c5 Ne4 8. Bd2 Nxd2 9. Qxd2 a5",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 c5 5. Bd3 Nc6 6. Nf3 Bxc3+ 7. bxc3 d6 8. O-O e5",

    // Notes nimzo
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5 5. dxc5 O-O 6. a3 (6. Nf3 Na6) 6... Bxc5 7. Nf3 Nc6 8. Bg5 Nd4 9. Nxd4 Bxd4 10. e3 Qa5 11. exd4 Qxg5",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5 5. dxc5 O-O 6. Nf3 Na6",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 c5 5. a3 Bxc3+ 6. Qxc3 cxd4 7. Qxd4 Nc6",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Bg5 c5 5. e3 Qa5 6. Bxf6 Bxc3+ 7. bxc3 Qxc3+ 8. Ke2 gxf6 9. Rc1 Qa3",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Bg5 c5 5. a3 Bxc3+ 6. bxc3 h6 7. Bxf6 Qxf6 8. e3 b6",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Bg5 c5 5. a3 Bxc3+ 6. bxc3 h6 7. Bh4 Qa5 8. Qd3 cxd4 9. Qxd4 Nc6",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Bg5 c5 5. a3 Bxc3+ 6. bxc3 h6 7. Bh4 Qa5 8. Qd3 cxd4 9. Bxf6 gxf6 10. Qxd4 Ke7",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 c5 5. Bd3 Nc6 6. Nf3 Bxc3+ 7. bxc3 d6 8. O-O e5",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 c5 5. Ne2 cxd4 6. exd4 d5 7. c5 Ne4 8. Bd2 Nxd2 9. Qxd2 a5 10. a3 Bxc3 11. Nxc3 a4 12. Bd3 b6",
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 c5 5. Ne2 cxd4 6. exd4 d5 7. a3 Be7 8. Nf4 dxc4 9. Bxc4 O-O",

    // Other

];

function book_move() {
    if (get_move_number() > 10 || document.getElementById("fen").value) { // don't book move when loaded fen
        return 0; 
    }

    let res = [];
    let game_so_far = get_game_moves();
    for (let i = 0; i < book_games.length; i++) {
        if (book_games[i].startsWith(game_so_far)) {
            res.push(i);
        }
    }
    if (!res.length) { return 0; }
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
    
    let row; let col; let new_row; let new_col;
    if (move[0] == "O") {
        row = 0;
        col = (PLAYER_WHITE) ? 4 : 3;
        new_row = 0;
        if (move.length > 3) {
            new_col = (PLAYER_WHITE) ? col - 2 : col + 2;
        } else {
            new_col = (PLAYER_WHITE) ? col + 2 : col - 2;
        }
        return create_move(8 * row + col, 8 * new_row + new_col, 11, 0, 0, 0, 0, 1);
    }

    if (move[move.length - 1] == "+") { move = move.slice(0, move.length - 1); }

    if (PLAYER_WHITE) {
        new_row = 8 - parseInt(move[move.length - 1]);
        new_col = move[move.length - 2].charCodeAt() - 97;
    } else {
        new_row = parseInt(move[move.length - 1]) - 1;
        new_col = 7 - (move[move.length - 2].charCodeAt() - 97);
    }

    let values = { "P": 0, "N": 1, "B": 2, "R": 3, "Q": 4, "K": 5 };
    if (move[0] == move[0].toUpperCase()) { // N B R Q K
        piece_val = values[move[0]];
    } else {
        piece_val = 0;
    }
    piece_val += 6;

    let moves = generate_pseudo_moves();
    let target_square = 8 * new_row + new_col;
    for (let i = 0; i < moves.length; i++) {
        if (get_move_target(moves[i]) == target_square && get_move_piece(moves[i]) == piece_val) {
            return moves[i];
        }
    }
    return 0;
}

// HASING -----------------------------------------------------------------------------------------------------------------------------------------------

class HashEntry {
    constructor() {
        this.first = 0;
        this.last = 0;
        this.depth = 0;

        this.flag = 0;
        this.score = 0;
    }
}

class HashTable {
    constructor() {
        this.hashes = {};
    }   

    get(depth, alpha, beta) {
        let key = ((hash_key[0] % HASH_SIZE) + (hash_key[1] % HASH_SIZE)) % HASH_SIZE;
        let entry = this.hashes[key];
        if (entry != null && entry.first == hash_key[0] && entry.last == hash_key[1] && entry.depth >= depth) {
            if (entry.flag == 1) { return entry.score; } // exact
            if (entry.flag == 2 && entry.score <= alpha) { return alpha; } // alpha
            if (entry.flag == 3 && entry.score >= beta) { return beta; } // beta
        }
        return null
    }

    set(depth, flag, score) {
        let entry = new HashEntry();
        entry.first = hash_key[0];
        entry.last = hash_key[1];
        entry.depth = depth;
        entry.flag = flag;
        entry.score = score;

        let key = ((hash_key[0] % HASH_SIZE) + (hash_key[1] % HASH_SIZE)) % HASH_SIZE;
        this.hashes[key] = entry;
    }
}

function init_zobrist() {
    let number = Math.pow(2, 32);
    
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
            let square = lsb_index(b);
            res = xor_bitboards(res, ZOB_TABLE[square][i]);
            pop_bit(b, square);
        }
    }
    if (TURN) { res = xor_bitboards(res, ZOB_TABLE[64]); }
    res = xor_bitboards(res, ZOB_TABLE[65][CASTLE]) // castle
    if (EN_PASSANT_SQUARE) { res = xor_bitboards(res, ZOB_TABLE[66][EN_PASSANT_SQUARE]); }
    return res;
}

// EVALUATE -----------------------------------------------------------------------------------------------------------------------------------------------

function get_gamephase_score() {
    let res = 0;
    for (let i = 1; i < 5; i++) { // TODO: start at i=0?
        res += count_bits(BOARD[i]) * piece_values[i];
        res += count_bits(BOARD[i + 1]) * piece_values[i];
    }
    return res;
}

function piece_val_map(piece, pos, opening) {
    if (piece >= 6) {
        piece -= 6;
        pos += (7 - (pos / 8 << 1)) << 3; // flip rows
    }
    if (!PLAYER_WHITE) {
        pos += 7 - (pos % 8 << 1); // flip cols
    }
    if (opening) { return piece_values[piece] + m[piece][pos]; }
    return piece_values[piece + 6] + m[piece + 6][pos]; 
}

function evaluate_board() { // LOWER BOUND
    let opening_res = 0;
    let endgame_res = 0;
    for (let piece = 0; piece < 12; piece++) {
        let theboard = copy_bitboard(BOARD[piece]);
        while (bool_bitboard(theboard)) {
            let index = lsb_index(theboard);

            if (piece < 6) { // player
                opening_res += piece_val_map(piece, index, 1);
                endgame_res += piece_val_map(piece, index, 0);
            } else { // ai
                opening_res -= piece_val_map(piece, index, 1);
                endgame_res -= piece_val_map(piece, index, 0);
            }

            pop_bit(theboard, index);
        }
    }

    let gamephase_score = get_gamephase_score();
    let res = 0;
    if (gamephase_score > opening_phase) { // OPENING
        GAMEPHASE = 0;
        res = opening_res;
    } else if (gamephase_score < endgame_phase) { // ENDGAME
        GAMEPHASE = 2;
        res = endgame_res; 
    } else { // MIDDLEGAME
        GAMEPHASE = 1;
        res = (opening_res * gamephase_score + endgame_res * (opening_phase - gamephase_score)) / opening_phase << 0;
    }
    return (TURN) ? -res : res;
}

function score_move(move) { // IMPORTANT
    if (score_pv && move == pv_table[0][ply]) {
        score_pv = 0;
        return 20000; // was determined best move in prev search
    }

    let source = get_move_source(move);
    let target = get_move_target(move); 
    let piece = get_move_piece(move);
    let piece_type = piece % 6;

    if (get_move_capture(move)) {
        for (let i = 6 * (1 - TURN); i < 6 * (1 - TURN) + 6; i++) {
            if (get_bit(BOARD[i], target)) {
                return 10005 - piece_type + 100 * (i % 6 + 1); // + capture_val(piece, i);
            }
        }
        // En passant
        return 10105;
    }
    if (move == killer_moves[0][ply]) { return 9000; }
    else if (move == killer_moves[1][ply]) { return 8000; }
    else { 
        let res = history_moves[piece][target]; 

        // Encourage moving away from attacked square
        let threatened_by_pawn = (!TURN && bool_bitboard(and_bitboards(PAWN_ATTACK[1][source], BOARD[0]))) || (TURN && bool_bitboard(and_bitboards(PAWN_ATTACK[0][source], BOARD[6])));
        let threatened_by_minor = (bool_bitboard(and_bitboards(KNIGHT_ATTACK[source], TURN ? BOARD[7] : BOARD[1]))) || (get_bit(bishop_attack(TURN), source));
        let threatened_by_rook = get_bit(rook_attack(TURN), source);

        if (piece_type >= 1 && threatened_by_pawn) { res += 3 * piece_type; }
        else if (piece_type >= 3 && threatened_by_minor) { res += 2 * piece_type; }
        else if (piece_type >= 4 && threatened_by_rook) { res += piece_type; }

        // // Discourage moving to attacked square
        // let target_attacked = is_square_attacked(target, TURN ^ 1);
        // if (target_attacked) {
        //     target_attacked--;
        //     res -= 100 * Math.max(piece % 6 - target_attacked % 6, 0);
        // }

        return res;
    }
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

function order_moves(moves) {
    let res = [];
    for (let i = 0; i < moves.length; i++) {
        let entry = [score_move(moves[i]), moves[i]];
        res.push(entry);
    }
    res.sort(function(a, b) { return b[0] - a[0]; });
    for (let i = 0; i < res.length; i++) {
        res[i] = res[i][1];
    }
    return res;
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
        let cg = GAMEPHASE;
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
        GAMEPHASE = cg;
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

function is_repetition() {
    return GAME_HASH.filter(x => x[0] == hash_key[0] && x[1] == hash_key[1]).length >= 2;
}

function best_eval(depth, alpha, beta) {
    if (is_repetition()) { return 0; } 

    let score = HASH_TABLE.get(depth, alpha, beta);
    if (ply && score != null) {
        LOOKUP++;
        return score;
    }

    let found_pv = 0;
    pv_length[ply] = ply;

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
        let cg = GAMEPHASE;
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
        GAMEPHASE = cg;
        EN_PASSANT_SQUARE = copy_en;
        TURN = copy_turn;
        hash_key = copy_hash;
        
        if (eval >= beta) { // Opponent response too stong, snip this move
            HASH_TABLE.set(depth, 2, eval);
            if (!get_move_capture(move)) {
                killer_moves[1][ply] = killer_moves[0][ply];
                killer_moves[0][ply] = move;
            }
            return beta;
        }

        if (eval > alpha) {
            hash_flag = 1; // exact

            if (!get_move_capture(move)) {
                history_moves[get_move_piece(move)][get_move_target(move)] += depth;
            }
            alpha = eval;
            hash_flag = 1; found_pv = 1;

            pv_table[ply][ply] = move; // write PV move
            for (let next_ply = ply + 1; next_ply < pv_length[ply + 1]; next_ply++) { 
                pv_table[ply][next_ply] = pv_table[ply + 1][next_ply]; 
            }
            pv_length[ply] = pv_length[ply + 1];
        }        
    }
    
    if (!legal_moves) {
        let king_pos = lsb_index(BOARD[6 * TURN + 5]);
        if (king_pos == -1) { document.getElementById("error").innerHTML = "<p>NO KING</p>"; console.log("WHAT THE"); return -100000; }

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
        return [0, 0, []];
    } 

    console.log("Lookahead:", depth);
    let eval = 0; let start = performance.now(); 
    for (let current_depth = 1; current_depth <= depth; current_depth++) {
        follow_pv = 1;

        eval = best_eval(current_depth, -Infinity, Infinity);

        let res = "Depth: " + (current_depth) + ", analysed: " + (COUNT) + ", eval: " + (eval) + ", PV: ";
        for (let i = 0; i < pv_length[0]; i++) {
            res += get_move_desc(pv_table[0][i]) + " ";
        }
        console.log(res);
    } 
    if (pv_table[0][0]) {
        console.log("Best move: " + (get_move_desc(pv_table[0][0])) + ", eval: " + (eval * (PLAYER_WHITE ? -1 : 1)));
    }
    console.log(" ");

    return [eval, Math.round(performance.now() - start), generate_pseudo_moves()];
}

// MAIN -----------------------------------------------------------------------------------------------------------------------------------------------

let ply = 0;
let MAX_PLY = 64;
let MAX_TIME = 10 * 1000;

let killer_moves;; // id, ply
let history_moves;; // piece, square
let pv_length; // ply
let pv_table; // ply, ply
let follow_pv; let score_pv;

let row_masks; let col_masks;
let isolated_masks;
let player_passed_masks; let ai_passed_masks;

let hash_key;
let ZOB_TABLE = [];
let HASH_TABLE;
let HASH_SIZE = 67108864;

let COUNT = 0;
let LOOKUP = 0;