#include <iostream>
#include <vector>
using namespace std;
#include <string> 
using namespace std;
#include <chrono>
using namespace std::chrono;

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

// ------------------------------ GLOBALS ------------------------------

U64 BOARD[15];
int TURN;
int ENPASSANT;
int CASTLE;
U64 HASH;

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
    0001    player king
    0010    player queen
    0100    ai king
    1000    ai queen
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

// ------------------------------ BOARD ------------------------------

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

U64* create_board(int board[]) {
    U64 res[15];
    for (int i = 0; i < 64; i++) { // pieces
        int piece = board[i];
        if (piece) {
            set_bit(res[piece - 1], i);
        }
    }
    for (int i = 0; i < 6; i++) {
        res[12] |= res[i]; // player
        res[13] |= res[i + 6]; // ai
    }
    res[14] = res[12] | res[13]; // board
    U64* r = res;
    return r;
}
void create_board(string fen) {
    // restore_board();
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
                    CASTLE &= 1;
                } else if (fen[i + j] == 'Q') {
                    CASTLE &= 2;
                } else if (fen[i + j] == 'k') {
                    CASTLE &= 4;
                } else if (fen[i + j] == 'q') {
                    CASTLE &= 8;
                }
                j++;
            }
            if (fen[i + j + 1] != '-') {
                ENPASSANT = ((8 - (int) fen[i + j + 2]) << 3) + (int) fen[i + j + 1] - 97;
            }
            break;
        } else if (c == '/') {
            pos += 7;
            pos -= pos % 8;
        } else if (isdigit(c)) {
            pos += (int) c;
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

int do_move(int move, int capture=0) {
    if (!move) { return 0; }
    if (capture && !get_move_capture(move)) { return 0; }
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
        if (TURN) {
            pop_bit(BOARD[0], target - 8);
        } else {
            pop_bit(BOARD[6], target + 8);
        }
    } else if (get_move_castle(move)) {
        if (target == 62) {
            pop_bit(BOARD[3], 63);
            pop_bit(BOARD[3], 61);
        } else if (target == 58) {
            pop_bit(BOARD[3], 56);
            pop_bit(BOARD[3], 59);
        } else if (target == 6) {
            pop_bit(BOARD[9], 7);
            pop_bit(BOARD[9], 5);
        } else if (target == 2) {
            pop_bit(BOARD[9], 0);
            pop_bit(BOARD[9], 3);
        }
    }
    ENPASSANT = 0;
    if (get_move_double(move)) {
        if (TURN) {
            ENPASSANT = target - 8;
        } else {
            ENPASSANT = target + 8;
        }
    }
    CASTLE &= CASTLING_RIGHTS[source];
    CASTLE &= CASTLING_RIGHTS[target];

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
    printf("\n");
}

// ------------------------------ AI FUNCTIONS ------------------------------

// ------------------------------ MAIN ------------------------------

void initialise() {
    initialise_move_constants();
}

int main() {

    initialise();

    create_board(start_position);

    moves move_list[1];
    generate_moves(move_list);

    do_move(move_list -> moves[19]);

    print_board();

    generate_moves(move_list);
    print_move_list(move_list);

    do_move(move_list -> moves[18]);

    print_board();
    // print_bitboard(BOARD[1]);
    // print_bitboard(BOARD[14]);

    return 0;
}