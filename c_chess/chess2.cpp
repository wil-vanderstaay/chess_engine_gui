#include <iostream>
#include <vector>
using namespace std;
#include <string> 
using namespace std;
#include <chrono>
using namespace std::chrono;

#include <cstdlib>

#include <fstream>
using namespace std;

// ------------------------------ CONSTANTS ------------------------------

#define U64 unsigned long long
#define start_position "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const int CASTLING_RIGHTS[64] = {
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

const int piece_score[6] = {
    100, 300, 320, 500, 800, 0,
};
const int positional_score[6][64] = {};

#define MAX_PLY 64
#define infinity 65535
#define checkmate 65534
#define matescore 65500

// ------------------------------ GLOBALS ------------------------------

U64 BOARD[15];
int TURN;
int ENPASSANT;
int CASTLE;
U64 HASH;

int ply;
int PV_LENGTH[MAX_PLY];
int PV_TABLE[MAX_PLY][MAX_PLY];
int follow_pv;
int score_pv;

U64 repititions[1000]; // 500 moves
int repitition_index;

int NODES;
int LOOKUP;

// ------------------------------ BITBOARD ------------------------------

#define get_bit(bitboard, i) ((bitboard) & (1ULL << i))
#define set_bit(bitboard, i) (bitboard |= 1ULL << i)
#define pop_bit(bitboard, i) ((bitboard) &= ~(1ULL << i))

int count_bits(U64 bitboard) {
    bitboard -= (bitboard >> 1) & 0x5555555555555555;
    bitboard = (bitboard & 0x3333333333333333) + ((bitboard >> 2) & 0x3333333333333333);
	return ((bitboard + (bitboard >> 4) & 0x0f0f0f0f0f0f0f0f) * 0x0101010101010101) >> 56;
}
int lsb_index(U64 bitboard) { return count_bits((bitboard & -bitboard) - 1); }
int pop_lsb_index(U64 &bitboard) {
    int index = lsb_index(bitboard);
    bitboard &= bitboard - 1;
    return index;
}

void print_bitboard(U64 bitboard) {
    for (int i = 0; i < 8; i++) {
        for (int j = 0; j < 8; j++) {
            printf("%d ", get_bit(bitboard, i * 8 + j) ? 1 : 0);
        }
        printf("\n");
    }
    printf("\n");
}
void print_binary(U64 bitboard) {
    for (int i = 8; i >= 0; i--) {
        for (int j = 8; j >= 0; j--) {
            printf("%d", get_bit(bitboard, i * 8 + j - 1) ? 1 : 0);
        }
    }
    printf("\n\n");
}

// ------------------------------ MOVE ------------------------------

/* 
    Encoding
    0000 0000 0000 0000 0000 0011 1111   source square
    0000 0000 0000 0000 1111 1100 0000   target square
    0000 0000 0000 1111 0000 0000 0000   piece 
    0000 0000 1111 0000 0000 0000 0000   promoted piece 
    0000 0001 0000 0000 0000 0000 0000   capture flag
    0000 0010 0000 0000 0000 0000 0000   double push flag
    0000 0100 0000 0000 0000 0000 0000   enpassant flag
    0000 1000 0000 0000 0000 0000 0000   castling flag
*/

int create_move(int source, int target, int piece, int promote=0, int capture=0, int two=0, int enpassant=0, int castle=0) {
    return (source) | (target << 6) | (piece << 12) | (promote << 16) | (capture << 20) | (two << 21) | (enpassant << 22) | (castle << 23);
}
int create_move(string uci) {
    int source = 351 - ((int) uci[1] * 8) + (int) uci[0];
    int target = 351 - ((int) uci[3] * 8) + (int) uci[2];
    int piece = 0;
    for (int i = 0; i < 12; i++) {
        if (get_bit(BOARD[i], source)) {
            piece = i;
            break;
        }
    }
    int promote = (uci.length() == 5) ? PIECES.find(uci[4]) + 6 * (TURN - 1) : 0;
    int two = (!(piece % 6) && abs((source >> 3) - (target >> 3)) == 2) ? 1 : 0;
    int enpassant = (!(piece % 6) && abs((source % 8) - (target % 8)) == 1 && !get_bit(BOARD[14], target)) ? 1 : 0;
    int capture = (enpassant || get_bit(BOARD[14], target)) ? 1 : 0;
    int castle = (piece % 6 == 5 && abs((source % 8) - (target % 8)) == 2) ? 1 : 0;
    return create_move(source, target, piece, promote, capture, two, enpassant, castle);
}
#define get_move_source(move) (move & 63)
#define get_move_target(move) ((move & 4032) >> 6)
#define get_move_piece(move) ((move & 61440) >> 12)
#define get_move_promote(move) ((move & 983040) >> 16)
#define get_move_capture(move) (move & 1048576)
#define get_move_double(move) (move & 2097152)
#define get_move_enpassant(move) (move & 4194304)
#define get_move_castle(move) (move & 8388608)

// ------------------------------ CASTLE ------------------------------

/*
    Encoding
    0001    white king
    0010    white queen
    0100    black king
    1000    black queen
*/

#define get_castle_wk() (CASTLE & 1)
#define get_castle_wq() (CASTLE & 2)
#define get_castle_bk() (CASTLE & 4)
#define get_castle_bq() (CASTLE & 8)
void print_castle() {
    if (get_castle_wk()) { printf("K"); }
    if (get_castle_wq()) { printf("Q"); }
    if (get_castle_bk()) { printf("k"); }
    if (get_castle_bq()) { printf("q"); }
    if (!CASTLE) { printf("-"); }
    printf("\n");
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
    int enpassant_copy;             \
    int castle_copy;                \
    int turn_copy;                  \
    memcpy(board_copy, BOARD, 120); \
    enpassant_copy = ENPASSANT;     \
    castle_copy = CASTLE;           \
    turn_copy = TURN

#define restore_board()             \
    memcpy(BOARD, board_copy, 120); \
    ENPASSANT = enpassant_copy;     \
    CASTLE = castle_copy;           \
    TURN = turn_copy
    
void print_board() {
    printf("\n");
    for (int i = 0; i < 8; i++) {
        printf("%d   ", 8 - i);
        for (int j = 0; j < 8; j++) {
            int k = i * 8 + j;
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
    printf("    a b c d e f g h\n\n");
}

void create_board(string fen) {
    reset_board();

    int row = 0;
    int col = 0;
    int i = 0;
    char c;
    while (fen[i] != ' ') {
        c = fen[i];
        if (c == '/') {
            row++;
            col = 0;
        } else if (isdigit(c)) {
            col += c - 48;
        } else {
            set_bit(BOARD[PIECES.find(c)], row * 8 + col);
            col++;
        }
        i++;
    }
    for (int b = 0; b < 6; b++) {
        BOARD[12] |= BOARD[b]; // white
        BOARD[13] |= BOARD[b + 6]; // black
    }
    BOARD[14] = BOARD[12] | BOARD[13]; // board

    TURN = fen[i + 1] == 'w' ? 0 : 1;
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
        ENPASSANT = (8 - (int) fen[i + j + 2]) * 8 + (int) fen[i + j + 1] - 97;
    }
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
    int r = square >> 3;
    int c = square % 8;
    int i;
    int o = 1;
    while (r + o < 8 && c + o < 8) { // + +
        i = square + 9 * o;
        set_bit(b, i);
        if (get_bit(blocker, i)) { break; }
        o++;
    }
    o = 1;
    while (r + o < 8 && 0 <= c - o) { // + -
        i = square + 7 * o;
        set_bit(b, i);
        if (get_bit(blocker, i)) { break; }
        o++;
    }
    o = 1;
    while (0 <= r - o && c + o < 8) { // - +
        i = square - 7 * o;
        set_bit(b, i);
        if (get_bit(blocker, i)) { break; }
        o++;
    }
    o = 1;
    while (0 <= r - o && 0 <= c - o) { // - -
        i = square - 9 * o;
        set_bit(b, i);
        if (get_bit(blocker, i)) { break; }
        o++;
    }
    return b;
}

U64 rook_attack_fly(int square, U64 blocker) {
    U64 b = 0ULL;
    int r = square >> 3;
    int c = square % 8;
    int i;
    int o = 1;
    while (r + o < 8) { // +.
        i = square + o * 8;
        set_bit(b, i);
        if (get_bit(blocker, i)) { break; }
        o++;
    }
    o = 1;
    while (0 <= r - o) { // -.
        i = square - o * 8;
        set_bit(b, i);
        if (get_bit(blocker, i)) { break; }
        o++;
    }
    o = 1;
    while (c + o < 8) { // .+
        i = square + o;
        set_bit(b, i);
        if (get_bit(blocker, i)) { break; }
        o++;
    }
    o = 1;
    while (0 <= c - o) { // .-
        i = square - o;
        set_bit(b, i);
        if (get_bit(blocker, i)) { break; }
        o++;
    }
    return b;
}

U64 queen_attack_fly(int square, U64 blocker) {
    return bishop_attack_fly(square, blocker) | rook_attack_fly(square, blocker);
}

int is_square_attacked(int square, int side) {
    int att = side * 6;
    if (!side && (PAWN_ATTACK[1][square] & BOARD[0])) { return 1; }
    if (side && (PAWN_ATTACK[0][square] & BOARD[6])) { return 1; }
    if (KNIGHT_ATTACK[square] & BOARD[att + 1]) { return 2; }
    if (bishop_attack_fly(square, BOARD[14]) & BOARD[att + 2]) { return 3; }
    if (rook_attack_fly(square, BOARD[14]) & BOARD[att + 3]) { return 4; }
    if (queen_attack_fly(square, BOARD[14]) & BOARD[att + 4]) { return 5; }
    if (KING_ATTACK[square] & BOARD[att + 5]) { return 6; }
    return 0;
}

int in_check() { return is_square_attacked(lsb_index(BOARD[6 * TURN + 5]), TURN ^ 1); }

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

    if (get_move_capture(move)) {
        for (int i = 6 * (TURN ^ 1); i < 6 * (TURN ^ 1) + 6; i++) {
            if (get_bit(BOARD[i], target)) {
                pop_bit(BOARD[i], target);
                break;
            }
        }
    }
    if (get_move_promote(move)) {
        pop_bit(BOARD[piece], target);
        set_bit(BOARD[get_move_promote(move)], target);
    } else if (get_move_enpassant(move)) {
        if (TURN) { pop_bit(BOARD[0], target - 8); } 
        else { pop_bit(BOARD[6], target + 8); }
    } else if (get_move_castle(move)) {
        int kingside = (target == 62) || (target == 6);
        int rook_source = (kingside) ? target + 1 : target - 2;
        int rook_target = (kingside) ? target - 1 : target + 1;
        int rook = piece - 2;

        pop_bit(BOARD[rook], rook_source);
        set_bit(BOARD[rook], rook_target);
    }

    ENPASSANT = 0;
    if (get_move_double(move)) { ENPASSANT = TURN ? target - 8 : target + 8; }
    CASTLE &= CASTLING_RIGHTS[source];
    CASTLE &= CASTLING_RIGHTS[target];

    BOARD[12] = 0ULL;
    BOARD[13] = 0ULL;
    for (int i = 0; i < 6; i++) {
        BOARD[12] |= BOARD[i]; // player
        BOARD[13] |= BOARD[i + 6]; // ai
    }
    BOARD[14] = BOARD[12] | BOARD[13]; // board

    if (in_check()) {
        restore_board();
        return 0;
    }
    TURN ^= 1;
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
                add_move(move_list, create_move(source, target, piece, piece + 1)); // knight
                add_move(move_list, create_move(source, target, piece, piece + 2)); // bishop
                add_move(move_list, create_move(source, target, piece, piece + 3)); // rook
                add_move(move_list, create_move(source, target, piece, piece + 4)); // queen
            } else {
                // One square push
                add_move(move_list, create_move(source, target, piece));
                // Two square push
                att = (target << 1) - source;
                if (source >> 3 == (TURN ? 1 : 6) && !get_bit(BOARD[14], att)) {
                    add_move(move_list, create_move(source, att, piece, 0, 0, 1));
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
        if (TURN ? get_castle_bk() : get_castle_wk()) {
            if (!get_bit(BOARD[14], kp + 1) && !get_bit(BOARD[14], kp + 2)) {
                if (!is_square_attacked(kp, TURN ^ 1) && !is_square_attacked(kp + 1, TURN ^ 1)) {
                    add_move(move_list, create_move(kp, kp + 2, piece, 0, 0, 0, 0, 1));
                }
            }
        }
        if (TURN ? get_castle_bq() : get_castle_wq()) {
            if (!get_bit(BOARD[14], kp - 1) && !get_bit(BOARD[14], kp - 2) && !get_bit(BOARD[14], kp - 3)) {
                if (!is_square_attacked(kp, TURN ^ 1) && !is_square_attacked(kp - 1, TURN ^ 1)) {
                    add_move(move_list, create_move(kp, kp - 2, piece, 0, 0, 0, 0, 1));
                }
            }
        }
    }
}

string get_move_uci(short int move) {
    short int source = get_move_source(move);
    short int target = get_move_target(move);
    string res;
    res.push_back((char) (source % 8 + 97));
    res.push_back((char) (56 - (source >> 3)));
    res.push_back((char) (target % 8 + 97));
    res.push_back((char) (56 - (target >> 3)));
    return res;
}
string get_move_desc(int move) {
    int source = get_move_source(move);
    int target = get_move_target(move);
    int piece = get_move_piece(move);
    int promote = get_move_promote(move);
    int capture = get_move_capture(move);

    if (get_move_castle(move)) { return (source < target) ? "O-O" : "O-O-O"; }  
    
    string res;
    // piece name or pawn column if capture
    if (piece % 6) { res.push_back(PIECES[piece % 6]); }
    else if (capture) { res.push_back((char) (source % 8 + 97)); }

    // Disambiguate moves for pgn eg. Nge2
    moves move_list[1];
    generate_moves(move_list);
    for (int i = 0; i < move_list -> count; i++) {
        // Not this move, same piece not pawn, same target square
        int other_move = move_list -> moves[i];
        if (move != other_move && piece % 6 && piece == get_move_piece(other_move) && target == get_move_target(other_move)) {
            int other_source = get_move_source(other_move);
            if ((other_source % 8) == (source % 8)) { res.push_back((char) (57 - (source >> 3))); }
            else { res.push_back((char) (source % 8 + 97)); }
            break;
        }
    }
    if (capture) { res += 'x'; }
    res.push_back((char) (target % 8 + 97));
    res.push_back((char) (56 - (target >> 3)));
    if (promote) {
        res.push_back('=');
        if (promote == 15) {
            for (int i = 0; i < 12; i++) {
                if (get_bit(BOARD[i], target)) {
                    if (i % 6) { res.push_back(PIECES[i % 6]); }
                    break;
                }
            }
        } else { res.push_back(PIECES[promote % 6]); }
    }
    return res;
}

void print_move_list(moves* move_list) {
    for (int i = 0; i < move_list -> count; i++) {
        int move = move_list -> moves[i];
        // printf("%s %s %d\n", get_move_desc(move).c_str(), get_move_uci(move).c_str(), move);
        printf("%s\n", get_move_desc(move).c_str());
    }
    printf("\n\n");
}

// ------------------------------ MAGIC NUMBER GENERATION ------------------------------

int RANDOM_STATE = 1804289383;
U64 random_32() {
    RANDOM_STATE ^= RANDOM_STATE << 13;
    RANDOM_STATE ^= RANDOM_STATE >> 17;
    RANDOM_STATE ^= RANDOM_STATE << 5;
    return RANDOM_STATE;
}
U64 random_64() { 
    U64 x1 = random_32() & 0xffff;
    U64 x2 = random_32() & 0xffff;
    U64 x3 = random_32() & 0xffff;
    U64 x4 = random_32() & 0xffff;
    return x1 | (x2 << 16) | (x3 << 32) | (x4 << 48);
}
U64 random_magic() { return random_64() & random_64() & random_64(); }

int BISHOP_RELEVANT_BITS[64] = {
    6, 5, 5, 5, 5, 5, 5, 6, 
    5, 5, 5, 5, 5, 5, 5, 5, 
    5, 5, 7, 7, 7, 7, 5, 5, 
    5, 5, 7, 9, 9, 7, 5, 5, 
    5, 5, 7, 9, 9, 7, 5, 5, 
    5, 5, 7, 7, 7, 7, 5, 5, 
    5, 5, 5, 5, 5, 5, 5, 5, 
    6, 5, 5, 5, 5, 5, 5, 6
};
int ROOK_RELEVANT_BITS[64] = {
    12, 11, 11, 11, 11, 11, 11, 12, 
    11, 10, 10, 10, 10, 10, 10, 11, 
    11, 10, 10, 10, 10, 10, 10, 11, 
    11, 10, 10, 10, 10, 10, 10, 11, 
    11, 10, 10, 10, 10, 10, 10, 11, 
    11, 10, 10, 10, 10, 10, 10, 11, 
    11, 10, 10, 10, 10, 10, 10, 11, 
    12, 11, 11, 11, 11, 11, 11, 12
};

U64 get_occupancy(int index, int free_bits_in_mask, U64 attack_mask) {
    U64 res = 0ULL;
    for (int i = 0; i < free_bits_in_mask; i++) {
        int square = pop_lsb_index(attack_mask);
        if (index & (1 << i)) { // ith bit must be in index binary
            set_bit(res, square);
        }
    }
    return res;
}

U64 mask_bishop_attacks(int square) {   
    U64 res = 0ULL;
    int r, f;
    int tr = square >> 3;
    int tf = square & 7;
    for (r = tr + 1, f = tf + 1; r <= 6 && f <= 6; r++, f++) { set_bit(res, r * 8 + f); }
    for (r = tr - 1, f = tf + 1; r >= 1 && f <= 6; r--, f++) { set_bit(res, r * 8 + f); }
    for (r = tr + 1, f = tf - 1; r <= 6 && f >= 1; r++, f--) { set_bit(res, r * 8 + f); }
    for (r = tr - 1, f = tf - 1; r >= 1 && f >= 1; r--, f--) { set_bit(res, r * 8 + f); }
    return res;
}

U64 mask_rook_attacks(int square) {
    U64 res = 0ULL;
    int r, f;
    int tr = square >> 3;
    int tf = square & 7;
    for (r = tr + 1; r <= 6; r++) { set_bit(res, r * 8 + tf); }
    for (r = tr - 1; r >= 1; r--) { set_bit(res, r * 8 + tf); }
    for (f = tf + 1; f <= 6; f++) { set_bit(res, tr * 8 + f); }
    for (f = tf - 1; f >= 1; f--) { set_bit(res, tr * 8 + f); }
    return res;
}

U64 generate_magic(int square, int is_bishop) {
    int relevant_bits = is_bishop ? BISHOP_RELEVANT_BITS[square] : ROOK_RELEVANT_BITS[square];
    int occupancy_indicies = 1 << relevant_bits;
    U64 attack_mask = is_bishop ? mask_bishop_attacks(square) : mask_rook_attacks(square);

    U64 occupancies[4096];
    U64 attacks[4096];
    U64 used_attacks[4096];
    for (int i = 0; i < 4096; i++) { 
        occupancies[i] = 0ULL;
        attacks[i] = 0ULL;
        used_attacks[i] = 0ULL;
    }

    for (int i = 0; i < occupancy_indicies; i++) {
        occupancies[i] = get_occupancy(i, relevant_bits, attack_mask); 
        attacks[i] = is_bishop ? bishop_attack_fly(square, occupancies[i]) : rook_attack_fly(square, occupancies[i]);
    }
    printf("GOAL = %d", 1);
    
    int max = 0;
    for (int r = 0; r < 10000; r++) {
        U64 magic = random_magic();
        if (count_bits((attack_mask * magic) & 0xFF00000000000000) < 6) { continue; }

        int fail = 0;
        for (int i = 0; !fail && i < occupancy_indicies; i++) {
            int magic_index = (int) ((occupancies[i] * magic) >> (64 - relevant_bits));
            if (!used_attacks[magic_index]) {
                used_attacks[magic_index] = attacks[i];
            } else if (used_attacks[magic_index] != attacks[i]) {
                if (i > max) { max = i; printf("M = %d", i); }
                fail = 1;
            }
        }
        if (!fail) { printf("R = %d", r); return magic; }
    }
    printf("*************** FAIL ***************");
    return 0;
}

void test_magic(int square, int is_bishop, U64 magic=0) {
    if (!magic) { magic = generate_magic(square, is_bishop); }

    int relevant_bits = is_bishop ? BISHOP_RELEVANT_BITS[square] : ROOK_RELEVANT_BITS[square];
    int occupancy_indicies = 1 << relevant_bits;
    U64 attack_mask = is_bishop ? mask_bishop_attacks(square) : mask_rook_attacks(square);
    
    U64 r;
    for (int i = 0; i < occupancy_indicies; i++) {
        r = get_occupancy(i, relevant_bits, attack_mask); 

        r &= attack_mask;
        r *= magic;
        r >>= 64 - relevant_bits;

        printf("%d ", r);
    }
}

// ------------------------------ EVALUATION ------------------------------


int evaluate_board() {
    int res = 0;
    U64 b;
    for (int i = 0; i < 6; i++) {
        b = BOARD[i];
        while (b) {
            int square = pop_lsb_index(b);
            res += piece_score[i]; // + positional_score[i][square];
        }
        b = BOARD[i + 6];
        while (b) {
            int square = pop_lsb_index(b);
            square += 56 - (square >> 3) * 16; // flip rows. Maps from player perspective
            res -= piece_score[i]; // + positional_score[i][square];
        }
    }
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

static inline int score_move(int move, int defenders) {
    if (score_pv && move == PV_TABLE[0][ply]) {
        score_pv = 0;
        return 150; // best move from previous search
    }
    int res = 0;
    int target = get_move_target(move);
    int piece = get_move_piece(move) % 6;

    int att_piece = is_square_attacked(target, TURN ^ 1);
    if (att_piece) {
        if (piece == 5) { return -250; }

        if (!defenders && piece) { // piece sacrifice
            res = (-piece - 8) * 8;
        } else if (piece > att_piece - 1 && !(piece == 2 && att_piece - 1 == 1)) { // attacked by lesser piece (not NxB)
            res = (-piece * 8) + att_piece;
        }
    }

    if (get_move_capture(move)) {
        int cap_piece = 0;
        for (int i = 0; i < 6; i++) {
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
    return res;
}
static inline void order_moves(moves* move_list) {
    int max_history = 1;
    int defenders[64] = {};
    for (int i = 0; i < move_list -> count; i++) {
        int move = move_list -> moves[i];
        int piece = get_move_piece(move);
        int target = get_move_target(move);
        if (!(piece % 6) && !get_move_capture(move)) { continue; } // ignore pawn push
        defenders[target] += 1 + (piece % 6 ? 0 : 1); // count pawns twice
    }
    int scores[move_list -> count];
    for (int i = 0; i < move_list -> count; i++) {
        int move = move_list -> moves[i];
        scores[i] = score_move(move, defenders[get_move_target(move)]);
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
    }
}

int is_repitition() {
    return 0;
    int count = 0;
    for (int i = 0; i < repitition_index; i++) {
        if (repititions[i] == HASH) { 
            count++;
        }
    }
    return count > 2;
}

int best_eval_captures(int depth, int alpha, int beta) {
    NODES++;

    int eval = evaluate_board();
    if (eval >= beta) { return beta; } // beta cutoff
    else if (eval < alpha - 900) { return alpha; } // delta pruning
    else if (eval > alpha) { alpha = eval; }
    if (depth == 0 || ply >= MAX_PLY) { return eval; }

    moves move_list[1];
    generate_moves(move_list);
    order_moves(move_list);
    for (int i = 0; i < move_list -> count; i++) {
        int move = move_list -> moves[i];
        copy_board();
        if (!do_move(move, 1)) { continue; }

        ply++;
        eval = -best_eval_captures(depth - 1, -beta, -alpha);
        ply--;
        restore_board();

        if (eval >= beta) { return beta; }
        if (eval > alpha) { alpha = eval; }
    }
    return alpha;
}

int best_eval(int depth, int alpha, int beta) {
    if (is_repitition()) { return 0; }

    PV_LENGTH[ply] = ply;
    if (depth == 0 || ply >= MAX_PLY) { return best_eval_captures(8, alpha, beta); }

    NODES++;
    moves move_list[1];
    generate_moves(move_list);
    if (follow_pv) { enable_pv_scoring(move_list); }
    order_moves(move_list);

    int eval = 0;
    int legal_moves = 0;
    for (int i = 0; i < move_list -> count; i++) {
        int move = move_list -> moves[i];
        copy_board();
        if (!do_move(move)) { continue; }

        legal_moves++;
        repitition_index++;
        // repititions[repitition_index] = HASH;
        ply++;
        eval = -best_eval(depth - 1, -beta, -alpha);

        ply--;
        repitition_index--;
        restore_board();

        if (eval >= beta) {
            return beta;
        }
        if (eval > alpha) {
            alpha = eval;

            PV_TABLE[ply][ply] = move; // write PV move
            for (int next_ply = ply + 1; next_ply < PV_LENGTH[ply + 1]; next_ply++) { 
                PV_TABLE[ply][next_ply] = PV_TABLE[ply + 1][next_ply]; 
            }
            PV_LENGTH[ply] = PV_LENGTH[ply + 1];
        }
    }
    if (!legal_moves) { return in_check() ? -checkmate + ply : 0; }
    return alpha;
}

int search(int search_time=2500, int override_depth=0) {
    reset_search_tables();
    NODES = 0;
    LOOKUP = 0;
    ply = 0;
    follow_pv = 0; 
    score_pv = 0;

    int eval = 0; 
    int depth = 1;
    auto start = high_resolution_clock::now();
    while ((override_depth || duration_cast<microseconds>(high_resolution_clock::now() - start).count() <= search_time * 1000) && (!override_depth || depth <= override_depth)) {
        follow_pv = 1;
        eval = best_eval(depth, -infinity, infinity);
        
        // if (TURN) { eval *= -1; }
        // printf("Depth: %d, analysed: %d, lookup: %d, eval: %d, PV: ", depth, NODES, LOOKUP, eval);
        // for (int i = 0; i < PV_LENGTH[0]; i++) {
        //     printf("%s ", get_move_desc(PV_TABLE[0][i]).c_str());
        // }
        // printf("\n");

        if (abs(eval) > matescore) { break; }
        depth++;
    } 
    if (TURN) { eval *= -1; }
    int time = duration_cast<milliseconds>(high_resolution_clock::now() - start).count();
    printf("Move: %s\tDepth: %d\tEval: %+d\nNodes: %d\tLookup: %d\tTime (ms): %d\n", get_move_desc(PV_TABLE[0][0]).c_str(), depth, eval, NODES, LOOKUP, time);
    return eval;
}

void play_game(string start_fen) {
    create_board(start_fen);
    print_board();

    string pgn = "";
    int move;
    for (int i = 0; i < 100; i++) {
        pgn.append(to_string(i + 1)); 
        pgn.append(". "); 

        // Human move
        string uci;
        cout << "Enter move uci: ";
        cin >> uci;
        move = create_move(uci);
        while (!move || !do_move(move)) { 
            printf("Invalid uci\n"); 
            cout << "Enter move uci: ";
            cin >> uci;
            move = create_move(uci);
        }
        pgn.append(get_move_desc(move));
        pgn.append(" ");

        print_board();

        // Ai move
        search();
        printf("\n");
        move = PV_TABLE[0][0];
        if (!do_move(move)) { printf("Invalid AI move\n"); break; }
        pgn.append(get_move_desc(move));
        pgn.append(" ");

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
            printf("%s\t->\t%d\n", get_move_uci(move).c_str(), res - start_res);
        }
        restore_board();
    }
    if (print) { printf("%d\n", res); }
    return res;
}

// ------------------------------ MAIN ------------------------------

void initialise() {
    initialise_move_constants();
}

int main(int argc, char *argv[]) {
    initialise();

    create_board(start_position);

    test_magic(0, 0);


    // play_game(start_position);
    return 0;
}

/*
    OPEN TERMINAL
        ctrl ~
    COMPILE
        shift ctrl B
        g++


    STOCKFISH
        position startpos move e2e4 e7e5
        d
        go perft 4
*/