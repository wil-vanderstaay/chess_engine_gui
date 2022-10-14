#include <iostream>
#include <vector>
using namespace std;
#include <string> 
using namespace std;
#include <chrono>
using namespace std::chrono;

#include <cstdlib>

// ------------------------------ CONSTANTS ------------------------------

#define U64 unsigned long long
#define start_position "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const int CASTLING_RIGHTS[] = {
    7, 15, 15, 15,  3, 15, 15, 11,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    13, 15, 15, 15, 12, 15, 15, 14
};
const string PIECES = "PNBRQKpnbrqk";

U64 PAWN_ATTACK[2][64];
U64 KNIGHT_ATTACK[64];
U64 KING_ATTACK[64];

U64 ZOB_SQUARE[64][12];
U64 ZOB_TURN;
U64 ZOB_CASTLE[16];
U64 ZOB_ENPASSANT[64];

#define infinity 50000
#define mate_value 49000
#define mate_score 48000

#define opening_phase 6192
#define endgame_phase 518
const int piece_score[2][6] = {
    // opening material score
    82, 337, 365, 477, 1025, 0,
    // endgame material score
    94, 281, 297, 512, 936, 0
};
const int positional_score[2][6][64] = { // gamephase, piece, square
    // opening pawn
    0,   0,   0,   0,   0,   0,  0,   0,
    98, 134,  61,  95,  68, 126, 34, -11,
    -6,   7,  26,  31,  65,  56, 25, -20,
    -14,  13,   6,  21,  23,  12, 17, -23,
    -27,  -2,  -5,  12,  17,   6, 10, -25,
    -26,  -4,  -4, -10,   3,   3, 33, -12,
    -35,  -1, -20, -23, -15,  24, 38, -22,
    0,   0,   0,   0,   0,   0,  0,   0,
    // opening knight
    -167, -89, -34, -49,  61, -97, -15, -107,
    -73, -41,  72,  36,  23,  62,   7,  -17,
    -47,  60,  37,  65,  84, 129,  73,   44,
    -9,  17,  19,  53,  37,  69,  18,   22,
    -13,   4,  16,  13,  28,  19,  21,   -8,
    -23,  -9,  12,  10,  19,  17,  25,  -16,
    -29, -53, -12,  -3,  -1,  18, -14,  -19,
    -105, -21, -58, -33, -17, -28, -19,  -23,
    // opening bishop
    -29,   4, -82, -37, -25, -42,   7,  -8,
    -26,  16, -18, -13,  30,  59,  18, -47,
    -16,  37,  43,  40,  35,  50,  37,  -2,
    -4,   5,  19,  50,  37,  37,   7,  -2,
    -6,  13,  13,  26,  34,  12,  10,   4,
    0,  15,  15,  15,  14,  27,  18,  10,
    4,  15,  16,   0,   7,  21,  33,   1,
    -33,  -3, -14, -21, -13, -12, -39, -21,
    // opening rook
    32,  42,  32,  51, 63,  9,  31,  43,
    27,  32,  58,  62, 80, 67,  26,  44,
    -5,  19,  26,  36, 17, 45,  61,  16,
    -24, -11,   7,  26, 24, 35,  -8, -20,
    -36, -26, -12,  -1,  9, -7,   6, -23,
    -45, -25, -16, -17,  3,  0,  -5, -33,
    -44, -16, -20,  -9, -1, 11,  -6, -71,
    -19, -13,   1,  17, 16,  7, -37, -26,     
    // opening queen
    -28,   0,  29,  12,  59,  44,  43,  45,
    -24, -39,  -5,   1, -16,  57,  28,  54,
    -13, -17,   7,   8,  29,  56,  47,  57,
    -27, -27, -16, -16,  -1,  17,  -2,   1,
    -9, -26,  -9, -10,  -2,  -4,   3,  -3,
    -14,   2, -11,  -2,  -5,   2,  14,   5,
    -35,  -8,  11,   2,   8,  15,  -3,   1,
    -1, -18,  -9,  10, -15, -25, -31, -50,   
    // opening king
    -65,  23,  16, -15, -56, -34,   2,  13,
    29,  -1, -20,  -7,  -8,  -4, -38, -29,
    -9,  24,   2, -16, -20,   6,  22, -22,
    -17, -20, -12, -27, -30, -25, -14, -36,
    -49,  -1, -27, -39, -46, -44, -33, -51,
    -14, -14, -22, -46, -44, -30, -15, -27,
    1,   7,  -8, -64, -43, -16,   9,   8,
    -15,  36,  12, -54,   8, -28,  24,  14,

    // endgame pawn
    0,   0,   0,   0,   0,   0,   0,   0,
    178, 173, 158, 134, 147, 132, 165, 187,
    94, 100,  85,  67,  56,  53,  82,  84,
    32,  24,  13,   5,  -2,   4,  17,  17,
    13,   9,  -3,  -7,  -7,  -8,   3,  -1,
    4,   7,  -6,   1,   0,  -5,  -1,  -8,
    13,   8,   8,  10,  13,   0,   2,  -7,
    0,   0,   0,   0,   0,   0,   0,   0,
    // endgame knight
    -58, -38, -13, -28, -31, -27, -63, -99,
    -25,  -8, -25,  -2,  -9, -25, -24, -52,
    -24, -20,  10,   9,  -1,  -9, -19, -41,
    -17,   3,  22,  22,  22,  11,   8, -18,
    -18,  -6,  16,  25,  16,  17,   4, -18,
    -23,  -3,  -1,  15,  10,  -3, -20, -22,
    -42, -20, -10,  -5,  -2, -20, -23, -44,
    -29, -51, -23, -15, -22, -18, -50, -64,
    // endgame bishop
    -14, -21, -11,  -8, -7,  -9, -17, -24,
    -8,  -4,   7, -12, -3, -13,  -4, -14,
    2,  -8,   0,  -1, -2,   6,   0,   4,
    -3,   9,  12,   9, 14,  10,   3,   2,
    -6,   3,  13,  19,  7,  10,  -3,  -9,
    -12,  -3,   8,  10, 13,   3,  -7, -15,
    -14, -18,  -7,  -1,  4,  -9, -15, -27,
    -23,  -9, -23,  -5, -9, -16,  -5, -17,
    // endgame rook
    13, 10, 18, 15, 12,  12,   8,   5,
    11, 13, 13, 11, -3,   3,   8,   3,
    7,  7,  7,  5,  4,  -3,  -5,  -3,
    4,  3, 13,  1,  2,   1,  -1,   2,
    3,  5,  8,  4, -5,  -6,  -8, -11,
    -4,  0, -5, -1, -7, -12,  -8, -16,
    -6, -6,  0,  2, -9,  -9, -11,  -3,
    -9,  2,  3, -1, -5, -13,   4, -20,       
    // endgame queen
    -9,  22,  22,  27,  27,  19,  10,  20,
    -17,  20,  32,  41,  58,  25,  30,   0,
    -20,   6,   9,  49,  47,  35,  19,   9,
    3,  22,  24,  45,  57,  40,  57,  36,
    -18,  28,  19,  47,  31,  34,  39,  23,
    -16, -27,  15,   6,   9,  17,  10,   5,
    -22, -23, -30, -16, -16, -23, -36, -32,
    -33, -28, -22, -43,  -5, -32, -20, -41,    
    // endgame king
    -74, -35, -18, -18, -11,  15,   4, -17,
    -12,  17,  14,  17,  17,  38,  23,  11,
    10,  17,  23,  15,  20,  45,  44,  13,
    -8,  22,  24,  27,  26,  33,  26,   3,
    -18,  -4,  21,  24,  27,  23,   9, -11,
    -19,  -3,  11,  21,  23,  16,   7,  -9,
    -27, -11,   4,  13,  14,   4,  -5, -17,
    -53, -34, -21, -11, -28, -14, -24, -43
};

#define NULL_HASH 10000
#define MAX_PLY 64

// ------------------------------ GLOBALS ------------------------------

U64 BOARD[15];
int TURN;
int ENPASSANT;
int CASTLE;
U64 HASH;

unsigned int random_state = 1804289383;

typedef struct {
    U64 hash_key;
    int depth;
    int flag;
    int score;
} tt;
tt* HASH_TABLE = NULL;
int HASH_MAX = 0;

int ply;
int PV_LENGTH[MAX_PLY];
int PV_TABLE[MAX_PLY][MAX_PLY];
int KILLER_MOVES[2][MAX_PLY];
int HISTORY_MOVES[12][64];
int follow_pv;
int score_pv;

U64 repititions[1000]; // 500 moves
int repitition_index;

int NODES;

// ------------------------------ BITBOARD ------------------------------

#define get_bit(bitboard, i) ((bitboard) & (1ULL << (i)))
#define set_bit(bitboard, i) (bitboard |= (1ULL << i))
#define pop_bit(bitboard, i) ((bitboard) &= ~(1ULL << (i)))

int count_bits(U64 bitboard) {
    bitboard -= (bitboard >> 1) & 0x5555555555555555;
    bitboard = (bitboard & 0x3333333333333333) + ((bitboard >> 2) & 0x3333333333333333);
	return ((bitboard + (bitboard >> 4) & 0x0f0f0f0f0f0f0f0f) * 0x0101010101010101) >> 56;
}
int lsb_index(U64 bitboard) {
    return count_bits((bitboard & -bitboard) - 1);
}
int pop_lsb_index(U64 &bitboard) {
    int index = lsb_index(bitboard);
    bitboard &= bitboard - 1;
    return index;
}

void print_bitboard(U64 bitboard) {
    for (int i = 0; i < 8; i++) {
        for (int j = 0; j < 8; j++) {
            int bit = get_bit(bitboard, (i << 3) + j);
            printf("%d ", get_bit(bitboard, (i << 3) + j) ? 1 : 0);
        }
        printf("\n");
    }
    printf("\n");
}
void print_binary(U64 bitboard) {
    for (int i = 8; i >= 0; i--) {
        for (int j = 8; j >= 0; j--) {
            printf("%d", get_bit(bitboard, ((i << 3) + j) - 1) ? 1 : 0);
        }
    }
    printf("\n\n");
}

// ------------------------------ MOVE ------------------------------

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

int create_move(int source, int target, int piece, int promote=0, int capture=0, int two=0, int enpassant=0, int castle=0) {
    return (source) | (target << 6) | (piece << 12) | (promote << 16) | (capture << 20) | (two << 21) | (enpassant << 22) | (castle << 23);
}
#define get_move_source(move) (move & 63)
#define get_move_target(move) ((move & 4032) >> 6)
#define get_move_piece(move) ((move & 61440) >> 12)
#define get_move_promote(move) ((move & 983040) >> 16)
#define get_move_capture(move) ((move & 1048576) >> 20)
#define get_move_double(move) ((move & 2097152) >> 21)
#define get_move_enpassant(move) ((move & 4194304) >> 22)
#define get_move_castle(move) ((move & 8388608) >> 23)

// ------------------------------ CASTLE ------------------------------

/*
    Encoding
    0001    white king
    0010    white queen
    0100    black king
    1000    black queen
*/

#define get_castle_pk() (CASTLE & 1)
#define get_castle_pq() ((CASTLE & 2) >> 1)
#define get_castle_ak() ((CASTLE & 4) >> 2)
#define get_castle_aq() ((CASTLE & 8) >> 3)
void print_castle() {
    if (get_castle_pk()) { printf("K"); }
    if (get_castle_pq()) { printf("Q"); }
    if (get_castle_ak()) { printf("k"); }
    if (get_castle_aq()) { printf("q"); }
    if (!CASTLE) { printf("-"); }
    printf("\n");
}

// ------------------------------ HASH KEY ------------------------------

unsigned int rand_32() {
    random_state ^= random_state << 13;
    random_state ^= random_state >> 17;
    random_state ^= random_state << 5;
    return random_state;
}
U64 rand_64() {
    U64 n1, n2, n3, n4;
    n1 = (U64) (rand_32()) & 0xFFFF;
    n2 = (U64) (rand_32()) & 0xFFFF;
    n3 = (U64) (rand_32()) & 0xFFFF;
    n4 = (U64) (rand_32()) & 0xFFFF;
    return n1 | (n2 << 16) | (n3 << 32) | (n4 << 48);
}

void initialise_zobrist() {
    for (int i = 0; i < 64; i++) {
        for (int j = 0; j < 12; j++) {
            ZOB_SQUARE[i][j] = rand_64();
        }
        ZOB_ENPASSANT[i] = rand_64();
    }
    ZOB_TURN = rand_64();
    for (int i = 0; i < 16; i++) {
        ZOB_CASTLE[i] = rand_64();
    }
}
void initialise_hash() {
    for (int i = 0; i < 12; i++) {
        U64 b = BOARD[i];
        while (b) {
            int square = pop_lsb_index(b);
            HASH ^= ZOB_SQUARE[square][i];
        }
    }
    if (TURN) { HASH ^= ZOB_TURN; }
    HASH ^= ZOB_CASTLE[CASTLE];
    if (ENPASSANT) { HASH ^= ZOB_ENPASSANT[ENPASSANT]; }
}

// ------------------------------ BOARD ------------------------------

void reset_board() {
    for (int i = 0; i < 15; i++) {
        BOARD[i] = 0ULL;
    }
    TURN = 0;
    ENPASSANT = 0;
    CASTLE = 0;
    for (int i = 0; i < 1000; i++) {
        repititions[i] = 0ULL;
    }
    repitition_index = 0;
}

#define copy_board()                \
    U64 board_copy[15];             \
    int turn_copy;                  \
    int enpassant_copy;             \
    int castle_copy;                \
    memcpy(board_copy, BOARD, 120); \
    turn_copy = TURN;               \
    enpassant_copy = ENPASSANT;     \
    castle_copy = CASTLE;           \
    U64 hash_copy = HASH;

#define restore_board()             \
    memcpy(BOARD, board_copy, 120); \
    TURN = turn_copy;               \
    ENPASSANT = enpassant_copy;     \
    CASTLE = castle_copy;           \
    HASH = hash_copy; 

void create_board(string fen) {
    int pos = 0;
    for (int i = 0; i < fen.length(); i++) {
        char c = fen[i];
        if (c == ' ') {
            BOARD[12] = 0ULL;
            BOARD[13] = 0ULL;
            for (int b = 0; b < 6; b++) {
                BOARD[12] |= BOARD[b]; // player
                BOARD[13] |= BOARD[b + 6]; // ai
            }
            BOARD[14] = BOARD[12] | BOARD[13]; // board
            int j = 3;
            while (fen[i + j] != ' ') {
                if (fen[i + j] == 'K') {
                    CASTLE |= 1;
                } else if (fen[i + j] == 'Q') {
                    CASTLE |= 2;
                } else if (fen[i + j] == 'k') {
                    CASTLE |= 4;
                } else if (fen[i + j] == 'q') {
                    CASTLE |= 8;
                }
                j++;
            }
            if (fen[i + j + 1] != '-') {
                ENPASSANT = ((8 - (int) fen[i + j + 2]) << 3) + (int) fen[i + j + 1] - 97;
            }
            initialise_hash();
            return;
        } else if (c == '/') {
        } else if (isdigit(c)) {
            pos += c - 48;
        } else {
            int char_value = 0;
            if (c == 'N') { char_value = 1; }
            else if (c == 'B') { char_value = 2; }
            else if (c == 'R') { char_value = 3; }
            else if (c == 'Q') { char_value = 4; }
            else if (c == 'K') { char_value = 5; }
            else if (c == 'p') { char_value = 6; }
            else if (c == 'n') { char_value = 7; }
            else if (c == 'b') { char_value = 8; }
            else if (c == 'r') { char_value = 9; }
            else if (c == 'q') { char_value = 10; }
            else if (c == 'k') { char_value = 11; }
            set_bit(BOARD[char_value], pos);
            pos++;
        }
    }
}
void print_board() {
    for (int i = 0; i < 8; i++) {
        for (int j = 0; j < 8; j++) {
            int k = (i << 3) + j;
            if (get_bit(BOARD[14], k)) {
                for (int p = 0; p < 12; p++) {
                    if (get_bit(BOARD[p], k)) {
                        printf("%c ", PIECES[p]);
                    }
                }
            } else {
                printf("- ");
            }
        }
        printf("\n");
    }
    printf("\n");
}

// ------------------------------ GENERATE MOVES ------------------------------

void initialise_move_constants() {
    U64 b = 0ULL;
    for (int i = 0; i < 64; i++) {
        // Pawn
        b = 0ULL;
        int col = i % 8;
        if (8 < i && 0 < col) { set_bit(b, i - 9); }
        if (6 < i && col < 7) { set_bit(b, i - 7); }
        PAWN_ATTACK[0][i] = b;

        b = 0ULL;
        if (i < 57 && 0 < col) { set_bit(b, i + 7); }
        if (i < 55 && col < 7) { set_bit(b, i + 9); }
        PAWN_ATTACK[1][i] = b;

        // Knight
        b = 0ULL;
        int row = i >> 3;
        if (16 < i && 1 < row && 0 < col) { set_bit(b, i - 17); }
        if (14 < i && 1 < row && col < 7) { set_bit(b, i - 15); }
        if (9 < i && 0 < row && 1 < col) { set_bit(b, i - 10); }
        if (5 < i && 0 < row && col < 6) { set_bit(b, i - 6); }
        if (i < 58 && row < 7 && 1 < col) { set_bit(b, i + 6); }
        if (i < 54 && row < 7 && col < 6) { set_bit(b, i + 10); }
        if (i < 49 && row < 6 && 0 < col) { set_bit(b, i + 15); }
        if (i < 47 && row < 6 && col < 7) { set_bit(b, i + 17); }
        KNIGHT_ATTACK[i] = b;

        // King
        b = 0ULL;
        if (8 < i && 0 < row && 0 < col) { set_bit(b, i - 9); }
        if (7 < i && 0 < row) { set_bit(b, i - 8); }
        if (6 < i && 0 < row && col < 7) { set_bit(b, i - 7); }
        if (0 < i && 0 < col) { set_bit(b, i - 1); }
        if (i < 63 && col < 7) { set_bit(b, i + 1); }
        if (i < 57 && row < 7 && 0 < col) { set_bit(b, i + 7); }
        if (i < 56 && row < 7) { set_bit(b, i + 8); }
        if (i < 55 && row < 7 && col < 7) { set_bit(b, i + 9); }
        KING_ATTACK[i] = b;
    }
}

U64 bishop_attack_fly(int square, U64 blocker) {
    U64 b = 0ULL;
    int row = square >> 3;
    int col = square % 8;
    int r, c, i;
    for (r = row + 1, c = col + 1; r < 8 && c < 8; r++, c++) {
        i = (r << 3) + c;
        set_bit(b, i);
        if (get_bit(blocker, i)) { break; }
    }
    for (r = row + 1, c = col - 1; r < 8 && 0 <= c; r++, c--) {
        i = (r << 3) + c;
        set_bit(b, i);
        if (get_bit(blocker, i)) { break; }
    }
    for (r = row - 1, c = col + 1; 0 <= r && c < 8; r--, c++) {
        i = (r << 3) + c;
        set_bit(b, i);
        if (get_bit(blocker, i)) { break; }
    }
    for (r = row - 1, c = col - 1; 0 <= r && 0 <= c; r--, c--) {
        i = (r << 3) + c;
        set_bit(b, i);
        if (get_bit(blocker, i)) { break; }
    }
    return b;
}
U64 rook_attack_fly(int square, U64 blocker) {
    U64 b = 0ULL;
    int row = square >> 3;
    int col = square % 8;
    int r, c, i;
    for (r = row + 1; r < 8; r++) {
        i = (r << 3) + col;
        set_bit(b, i);
        if (get_bit(blocker, i)) { break; }
    }
    for (r = row - 1; 0 <= r; r--) {
        i = (r << 3) + col;
        set_bit(b, i);
        if (get_bit(blocker, i)) { break; }
    }
    for (c = col + 1; c < 8; c++) {
        i = (row << 3) + c;
        set_bit(b, i);
        if (get_bit(blocker, i)) { break; }
    }
    for (c = col - 1; 0 <= c; c--) {
        i = (row << 3) + c;
        set_bit(b, i);
        if (get_bit(blocker, i)) { break; }
    }
    return b;
}
U64 queen_attack_fly(int square, U64 blocker) {
    return bishop_attack_fly(square, blocker) | rook_attack_fly(square, blocker);
}

int is_square_attacked(int square, int side) {
    if (!side && (PAWN_ATTACK[1][square] & BOARD[0])) { return 1; }
    if (side && (PAWN_ATTACK[0][square] & BOARD[6])) { return 1; }
    if (KNIGHT_ATTACK[square] & (side ? BOARD[7] : BOARD[1])) { return 2; }
    if (bishop_attack_fly(square, BOARD[14]) & (side ? BOARD[8] : BOARD[2])) { return 3; }
    if (rook_attack_fly(square, BOARD[14]) & (side ? BOARD[9] : BOARD[3])) { return 4; }
    if (queen_attack_fly(square, BOARD[14]) & (side ? BOARD[10] : BOARD[4])) { return 5; }
    if (KING_ATTACK[square] & (side ? BOARD[11] : BOARD[5])) { return 6; }
    return 0;
}

int do_move(int move, int capture_only=0) {
    if (!move) { return 0; }
    if (capture_only && !get_move_capture(move)) { return 0; }
    copy_board();

    int source = get_move_source(move);
    int target = get_move_target(move);
    int piece = get_move_piece(move);

    // Move piece
    pop_bit(BOARD[piece], source);
    set_bit(BOARD[piece], target);
    HASH ^= ZOB_SQUARE[source][piece];
    HASH ^= ZOB_SQUARE[target][piece];

    if (get_move_capture(move)) {
        for (int i = 6 * (TURN ^ 1); i < 6 * (TURN ^ 1) + 6; i++) {
            if (get_bit(BOARD[i], target)) {
                pop_bit(BOARD[i], target);
                HASH ^= ZOB_SQUARE[target][i];
                break;
            }
        }
    }
    if (get_move_promote(move)) {
        pop_bit(BOARD[piece], target);
        set_bit(BOARD[get_move_promote(move)], target);
        HASH ^= ZOB_SQUARE[target][piece];
        HASH ^= ZOB_SQUARE[target][get_move_promote(move)];

    } else if (get_move_enpassant(move)) {
        if (TURN) {
            pop_bit(BOARD[0], target - 8);
            HASH ^= ZOB_SQUARE[target - 8][0];
        } else {
            pop_bit(BOARD[6], target + 8);
            HASH ^= ZOB_SQUARE[target + 8][6];
        }
    } else if (get_move_castle(move)) {
        if (target == 62) {
            pop_bit(BOARD[3], 63);
            set_bit(BOARD[3], 61);
            HASH ^= ZOB_SQUARE[63][3];
            HASH ^= ZOB_SQUARE[61][3];
        } else if (target == 58) {
            pop_bit(BOARD[3], 56);
            set_bit(BOARD[3], 59);
            HASH ^= ZOB_SQUARE[56][3];
            HASH ^= ZOB_SQUARE[59][3];
        } else if (target == 6) {
            pop_bit(BOARD[9], 7);
            set_bit(BOARD[9], 5);
            HASH ^= ZOB_SQUARE[7][9];
            HASH ^= ZOB_SQUARE[5][9];
        } else if (target == 2) {
            pop_bit(BOARD[9], 0);
            set_bit(BOARD[9], 3);
            HASH ^= ZOB_SQUARE[0][9];
            HASH ^= ZOB_SQUARE[3][9];
        }
    }
    if (ENPASSANT) {
        HASH ^= ZOB_ENPASSANT[ENPASSANT];
    }
    ENPASSANT = 0;
    if (get_move_double(move)) {
        if (TURN) {
            ENPASSANT = target - 8;
        } else {
            ENPASSANT = target + 8;
        }
            HASH ^= ZOB_ENPASSANT[ENPASSANT];
    }
    HASH ^= ZOB_CASTLE[CASTLE];
    CASTLE &= CASTLING_RIGHTS[source];
    CASTLE &= CASTLING_RIGHTS[target];
    HASH ^= ZOB_CASTLE[CASTLE];

    BOARD[12] = 0ULL;
    BOARD[13] = 0ULL;
    for (int i = 0; i < 6; i++) {
        BOARD[12] |= BOARD[i]; // player
        BOARD[13] |= BOARD[i + 6]; // ai
    }
    BOARD[14] = BOARD[12] | BOARD[13]; // board

    if (is_square_attacked(lsb_index(BOARD[6 * TURN + 5]), TURN ^ 1)) {
        restore_board();
        return 0;
    }
    TURN ^= 1;
    HASH ^= ZOB_TURN;
    return 1;
}

typedef struct {
    int moves[256];
    int count;
} moves;
static inline void add_move(moves* move_list, int move) {
    move_list -> moves[move_list -> count] = move;
    move_list -> count++;
}

static inline void generate_moves(moves* move_list) {
    move_list -> count = 0;
    int source, target, att;
    U64 attacks;

    // Pawn moves
    int piece = 6 * TURN;
    U64 b = BOARD[piece];
    while (b) {
        source = pop_lsb_index(b);
        target = TURN ? source + 8 : source - 8;

        // Push
        if (!get_bit(BOARD[14], target)) {
            if (target < 8 || 56 <= target) { // promotion
                add_move(move_list, create_move(source, target, piece, piece + 1)); // rook
                add_move(move_list, create_move(source, target, piece, piece + 2)); // knight
                add_move(move_list, create_move(source, target, piece, piece + 3)); // bishop
                add_move(move_list, create_move(source, target, piece, piece + 4)); // queen
            } else {
                // One square push
                add_move(move_list, create_move(source, target, piece));
                // Two square push
                int dtarget = target + target - source;
                if (source >> 3 == (TURN ? 1 : 6) && !get_bit(BOARD[14], dtarget)) {
                    add_move(move_list, create_move(source, dtarget, piece, 0, 0, 1));
                }
            }
        }

        // Capture
        attacks = PAWN_ATTACK[TURN][source] & BOARD[12 + TURN ^ 1];
        while (attacks) {
            att = pop_lsb_index(attacks);
            if (att < 8 || 56 <= att) { // Promote
                add_move(move_list, create_move(source, att, piece, piece + 1, 1));
                add_move(move_list, create_move(source, att, piece, piece + 2, 1));
                add_move(move_list, create_move(source, att, piece, piece + 3, 1));
                add_move(move_list, create_move(source, att, piece, piece + 4, 1));
            } else {
                add_move(move_list, create_move(source, att, piece, 0, 1));
            }
        }
        // En passant
        if (ENPASSANT && get_bit(PAWN_ATTACK[TURN][source], ENPASSANT)) {
            add_move(move_list, create_move(source, ENPASSANT, piece, 0, 1, 0, 1));
        }
    }
    // Knight moves
    piece++;
    b = BOARD[piece];
    while(b) {
        source = pop_lsb_index(b);
        attacks = KNIGHT_ATTACK[source] & ~BOARD[12 + TURN];
        while (attacks) {
            att = pop_lsb_index(attacks);
            if (get_bit(BOARD[12 + TURN ^ 1], att)) {
                add_move(move_list, create_move(source, att, piece, 0, 1));
            } else {
                add_move(move_list, create_move(source, att, piece));
            }
        }
    }
    // Bishop moves
    piece++;
    b = BOARD[piece];
    while(b) {
        source = pop_lsb_index(b);
        attacks = bishop_attack_fly(source, BOARD[14]) & ~BOARD[12 + TURN];
        while (attacks) {
            att = pop_lsb_index(attacks);
            if (get_bit(BOARD[12 + TURN ^ 1], att)) {
                add_move(move_list, create_move(source, att, piece, 0, 1));
            } else {
                add_move(move_list, create_move(source, att, piece));
            }
        }
    }
    // Rook moves
    piece++;
    b = BOARD[piece];
    while(b) {
        source = pop_lsb_index(b);
        attacks = rook_attack_fly(source, BOARD[14]) & ~BOARD[12 + TURN];
        while (attacks) {
            att = pop_lsb_index(attacks);
            if (get_bit(BOARD[12 + TURN ^ 1], att)) {
                add_move(move_list, create_move(source, att, piece, 0, 1));
            } else {
                add_move(move_list, create_move(source, att, piece));
            }
        }
    }
    // Queen moves
    piece++;
    b = BOARD[piece];
    while(b) {
        source = pop_lsb_index(b);
        attacks = queen_attack_fly(source, BOARD[14]) & ~BOARD[12 + TURN];
        while (attacks) {
            att = pop_lsb_index(attacks);
            if (get_bit(BOARD[12 + TURN ^ 1], att)) {
                add_move(move_list, create_move(source, att, piece, 0, 1));
            } else {
                add_move(move_list, create_move(source, att, piece));
            }
        }
    }
    // King moves
    piece++;
    b = BOARD[piece];
    // Normal moves
    source = lsb_index(b);
    attacks = KING_ATTACK[source] & ~BOARD[12 + TURN];
    while (attacks) {
        att = pop_lsb_index(attacks);
        if (get_bit(BOARD[12 + TURN ^ 1], att)) {
            add_move(move_list, create_move(source, att, piece, 0, 1));
        } else {
            add_move(move_list, create_move(source, att, piece));
        }
    }

    // Castling
    if (CASTLE) {
        int kp = TURN ? 4 : 60;
        if ((!TURN && get_castle_pk()) || (TURN && get_castle_ak())) {
            if (!get_bit(BOARD[14], kp + 1) && !get_bit(BOARD[14], kp + 2)) {
                if (!is_square_attacked(kp, TURN ^ 1) && !is_square_attacked(kp + 1, TURN ^ 1)) {
                    add_move(move_list, create_move(kp, kp + 2, piece, 0, 0, 0, 0, 1));
                }
            }
        }
        if ((!TURN && get_castle_pq()) || (TURN && get_castle_aq())) {
            if (!get_bit(BOARD[14], kp - 1) && !get_bit(BOARD[14], kp - 2) && !get_bit(BOARD[14], kp - 3)) {
                if (!is_square_attacked(kp, TURN ^ 1) && !is_square_attacked(kp - 1, TURN ^ 1)) {
                    add_move(move_list, create_move(kp, kp - 2, piece, 0, 0, 0, 0, 1));
                }
            }
        }
    }
}

string get_move_desc(int move) {
    int move_source = get_move_source(move);
    int move_target = get_move_target(move);
    int move_piece = get_move_piece(move);

    // Check castle moves
    if (get_move_castle(move)) {
        if (move_source < move_target) {
            return "O-O";
        }
        return "O-O-O";
    }

    string letters = "abcdefgh";
    int srow = move_source >> 3; int scol = move_source % 8;
    int trow = 7 - (move_target >> 3); int tcol = move_target % 8;

    string res;
    if (move_piece % 6) { 
        res = PIECES[move_piece % 6]; 
    }

    // Disambiguate moves for pgn eg. Nge2
    moves move_list[1];
    generate_moves(move_list);
    for (int i = 0; i < move_list -> count; i++) {
        // Not this move, same piece not pawn, same target square
        int other_move = move_list -> moves[i];
        if (move != other_move && move_piece == get_move_piece(other_move) && move_piece % 6 != 0 && move_target == get_move_target(other_move)) {
            if (scol == get_move_source(other_move) % 8) { // use numbers
                res.append(to_string(8 - srow));
            } else { // use letters
                res.push_back(letters[scol]);
            }
        }
    }

    // Check capture moves
    if (get_move_capture(move)) { 
        if (!res.length()) { res.push_back(letters[scol]); } // pawn capture
        res.push_back('x');
    }
    res.push_back(letters[tcol]); // move notation
    res.append(to_string(trow + 1));

    // Check promotion moves
    int move_promote = get_move_promote(move);
    if (move_promote) { 
        res.push_back('=');
        if (!PIECES[move_promote]) {
            res.push_back('Q'); 
        } else {
            res.push_back(PIECES[move_promote]); 
        }
    }
    return res;
}

void print_move_list(moves* move_list) {
    for (int i = 0; i < move_list -> count; i++) {
        int move = move_list -> moves[i];
        printf("%s\n", get_move_desc(move).c_str());
    }
    printf("\n\n");
}

// ------------------------------ HASH TABLE ------------------------------

void reset_hash_table() {
    tt* h;
    for (h = HASH_TABLE; h < HASH_TABLE + HASH_MAX; h++) {
        h -> hash_key = 0;
        h -> depth = 0;
        h -> flag = 0;
        h -> score = 0;
    }
}
void initialise_hash_table(int mb=64) {
    int hash_size = 0x100000 * mb;
    HASH_MAX = hash_size / sizeof(tt);

    if (HASH_TABLE != NULL) { free(HASH_TABLE); }
    HASH_TABLE = (tt*) malloc(HASH_MAX * sizeof(tt));
    if (HASH_TABLE == NULL) {
        printf("Couldn't allocate memory for hash table. Trying %dmb", mb / 2);
        initialise_hash_table(mb / 2);
    } else {
        reset_hash_table();
    }
}

static inline int read_hash(int depth, int alpha, int beta) {
    tt* h = &HASH_TABLE[HASH % HASH_MAX];
    if ((h -> hash_key == HASH) && (h -> depth >= depth)) {
        int score = h -> score;

        if (score < -mate_score) { score += ply; }
        if (score > mate_score) { score -= ply; }

        if (h -> flag == 0) { return score; }
        else if ((h -> flag == 1) && score <= alpha) { return alpha; }
        else if ((h -> flag == 2) && score >= beta) { return beta; }
    }
    return NULL_HASH;
}
static inline void write_hash(int score, int depth, int flag) {
    tt* h = &HASH_TABLE[HASH % HASH_MAX];

    if (score < -mate_score) { score += ply; }
    if (score > mate_score) { score -= ply; }

    h -> hash_key = HASH;
    h -> score = score;
    h -> depth = depth;
    h -> flag = flag;
}

// ------------------------------ EVALUATION ------------------------------

int gamephase_score() {
    int res = 0;
    for (int i = 1; i < 5; i++) { // ignore pawns and kings
        res += count_bits(BOARD[i]) * piece_score[0][i];
        res += count_bits(BOARD[i + 6]) * piece_score[0][i];
    }
    return res;
}
int piece_value_map(int piece, int square, int phase) {
    if (piece >= 6) {
        piece -= 6;
        square += (7 - (square >> 3 << 1)) << 3; // flip rows. Maps from player perspective
    }   
    return piece_score[phase][piece] + positional_score[phase][piece][square];
}

int evaluate_board() {
    int opening = 0;
    int endgame = 0;
    U64 b;
    for (int i = 0; i < 6; i++) {
        b = BOARD[i];
        while (b) {
            int square = pop_lsb_index(b);
            opening += piece_value_map(i, square, 0);
            endgame += piece_value_map(i, square, 1);
        }
        b = BOARD[i + 6];
        while (b) {
            int square = pop_lsb_index(b);
            opening -= piece_value_map(i + 6, square, 0);
            endgame -= piece_value_map(i + 6, square, 1);
        }
    }
    int score = gamephase_score();
    if (score > opening_phase) { return (TURN) ? -opening : opening; }
    if (score < endgame_phase) { return (TURN) ? -endgame : endgame; }
    int res = (opening * score + endgame * (opening_phase - score)) / opening_phase << 0;
    return (TURN) ? -res : res;
}

void enable_pv_scoring(moves* move_list) {
    follow_pv = 0;
    int pv_move = PV_TABLE[0][ply];
    if (!pv_move) { return; }
    for (int i = 0; i < move_list -> count; i++) {
        if (move_list -> moves[i] == pv_move) {
            follow_pv = 1;
            score_pv = 1;
            return;
        }
    }
}

static inline int score_move(int move, int attackers[64]) {
    if (score_pv && move == PV_TABLE[0][ply]) {
        score_pv = 0;
        return 20000; // best move from previous search
    }
    int target = get_move_target(move);
    int piece = get_move_piece(move);
    int piece_type = piece % 6;
    if (get_move_capture(move)) {
        for (int i = 6 * (TURN ^ 1); i < 6 * (TURN ^ 1) + 6; i++) {
            if (get_bit(BOARD[i], target)) {
                // minus attacker, plus captured piece, plus if multiple attackers
                return 10050 - 10 * piece_type + 100 * (i % 6 + 1) + (attackers[target] > 1);
            }
        }
        return 10105; // enpassant score
    }
    if (move == KILLER_MOVES[0][ply]) { return 9000; }
    if (move == KILLER_MOVES[1][ply]) { return 8000; }
    return min(7000, HISTORY_MOVES[piece][target]);
}
static inline void order_moves(moves* move_list) {
    int attackers[64] = {};
    for (int i = 0; i < move_list -> count; i++) {
        if (get_move_capture(move_list -> moves[i])) {
            attackers[get_move_target(move_list -> moves[i])]++;
        }
    }
    int scores[move_list -> count];
    for (int i = 0; i < move_list -> count; i++) {
        scores[i] = score_move(move_list -> moves[i], attackers);
    }
    for (int i = 0; i < move_list -> count; i++) {
        for (int j = i + 1; j < move_list -> count; j++) {
            if (scores[i] < scores[j]) {
                int temp = scores[i];
                scores[i] = scores[j];
                scores[j] = temp;

                temp = move_list -> moves[i];
                move_list -> moves[i] = move_list -> moves[j];
                move_list -> moves[j] = temp;
            }
        }
    }
}

// ------------------------------ AI DRIVERS ------------------------------

void reset_search_tables() {
    for (int i = 0; i < MAX_PLY; i++) {
        PV_LENGTH[i] = 0;
        for (int j = 0; j < MAX_PLY; j++) {
            PV_TABLE[i][j] = 0;
        }
        KILLER_MOVES[0][i] = 0;
        KILLER_MOVES[1][i] = 0;
    }
    for (int i = 0; i < 12; i++) {
        for (int j = 0; j < 64; j++) {
            HISTORY_MOVES[i][j] = 0;
        }
    }
}

int is_repitition() {
    int count = 0;
    for (int i = 0; i < repitition_index; i++) {
        if (repititions[i] == HASH) { 
            count++;
        }
    }
    return (count > 2) ? 1 : 0;
}

int best_eval_captures(int depth, int alpha, int beta) {
    NODES++;
    int eval = evaluate_board();
    if (depth == 0 || ply >= MAX_PLY) { return eval; }
    else if (eval >= beta) { return beta; }
    else if (eval < alpha - 900) { return alpha; }
    else if (eval > alpha) { alpha = eval; }

    moves move_list[1];
    generate_moves(move_list);
    order_moves(move_list);
    for (int i = 0; i < move_list -> count; i++) {
        int move = move_list -> moves[i];
        copy_board();
        if (!do_move(move, 1)) { continue; }

        ply++;
        int eval = -best_eval_captures(depth - 1, -beta, -alpha);
        ply--;
        restore_board();

        if (eval >= beta) { return beta; }
        if (eval > alpha) { alpha = eval; }
    }
    return alpha;
}
int best_eval(int depth, int alpha, int beta) {
    if (is_repitition()) { return 0; }

    int score = read_hash(depth, alpha, beta);
    if (ply && score != NULL_HASH) { return score; }
    PV_LENGTH[ply] = ply;
    if (depth == 0 || ply >= MAX_PLY) { return best_eval_captures(8, alpha, beta); }

    NODES++;
    moves move_list[1];
    generate_moves(move_list);
    
    if (follow_pv) { enable_pv_scoring(move_list); }
    order_moves(move_list);

    int legal_moves = 0;
    int flag = 1;
    for (int i = 0; i < move_list -> count; i++) {
        int move = move_list -> moves[i];
        copy_board();
        if (!do_move(move)) { continue; }

        legal_moves++;
        repitition_index++;
        repititions[repitition_index] = HASH;
        ply++;
        int eval = -best_eval(depth - 1, -beta, -alpha);
        ply--;
        repitition_index--;
        restore_board();

        if (eval > alpha) {
            flag = 0;
            alpha = eval;
            if (!get_move_capture(move)) {
                HISTORY_MOVES[get_move_piece(move)][get_move_target(move)] += depth * depth;
            }

            PV_TABLE[ply][ply] = move; // write PV move
            for (int next_ply = ply + 1; next_ply < PV_LENGTH[ply + 1]; next_ply++) { 
                PV_TABLE[ply][next_ply] = PV_TABLE[ply + 1][next_ply]; 
            }
            PV_LENGTH[ply] = PV_LENGTH[ply + 1];

            if (eval >= beta) {
                write_hash(eval, depth, 2);
                if (!get_move_capture(move)) {
                    KILLER_MOVES[1][ply] = KILLER_MOVES[0][ply];
                    KILLER_MOVES[0][ply] = move;
                }
                return beta;
            }
        }
    }

    if (!legal_moves) {
        int king = lsb_index(BOARD[6 * TURN + 5]);
        if (is_square_attacked(king, TURN ^ 1)) { return -mate_value + ply; }
        return 0;
    }
    write_hash(alpha, depth, flag);
    return alpha;
}

int search(int depth) {
    reset_search_tables();
    NODES = 0;
    ply = 0;
    follow_pv = 0; 
    score_pv = 0;

    int eval = 0; 
    for (int current_depth = 1; current_depth <= depth; current_depth++) {
        follow_pv = 1;
        eval = best_eval(current_depth, -infinity, infinity);
 
        printf("Depth: %i, analysed: %i, eval: %i, PV: ", current_depth, NODES, eval);
        for (int i = 0; i < PV_LENGTH[0]; i++) {
            printf("%s ", get_move_desc(PV_TABLE[0][i]).c_str());
        }
        printf("\n");
    } 
    printf("Best move: %s, eval: %d\n\n", get_move_desc(PV_TABLE[0][0]).c_str(), eval);
    return eval;
}

void play_game(string start_fen, int total_ply, int depth) {
    create_board(start_fen);
    print_board();

    string pgn = "";
    for (int i = 0; i < total_ply; i++) {
        search(depth);

        if (i % 2 == 0) { pgn.append(to_string(i / 2 + 1)); pgn.append(". "); }
        pgn.append(get_move_desc(PV_TABLE[0][0]));
        pgn.append(" ");

        do_move(PV_TABLE[0][0]);
        print_board();
    }
    printf("%s\n", pgn.c_str());
}

// ------------------------------ PERF TEST ------------------------------

int perft(int depth, int print=1) {
    if (depth == 0) { return 1; }
    
    int res = 0;
    moves move_list[1];
    generate_moves(move_list);
    for (int i = 0; i < move_list -> count; i++) {
        int move = move_list -> moves[i];
        copy_board();
        if (!do_move(move)) {
            continue;
        }
        int start_res = res;
        res += perft(depth - 1, 0);   

        if (print) {
            printf("%s\t->\t%d\n", get_move_desc(move).c_str(), res - start_res);
        }
        restore_board();
    }
    return res;
}

// ------------------------------ MAIN ------------------------------

void initialise() {
    initialise_move_constants();

    initialise_zobrist();
    initialise_hash_table();
}

int main(int argc, char *argv[]) {

    initialise();

    play_game(start_position, 50, 6);

    return 0;
}