#include <iostream>
#include <vector>
using namespace std;
#include <string> 
using namespace std;

#define U64 unsigned long long

// ------------------------------ GLOBALS ------------------------------

int CASTLING_RIGHTS[] = {
    7, 15, 15, 15,  3, 15, 15, 11,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    13, 15, 15, 15, 12, 15, 15, 14
};

int PLAYER_WHITE = 1;
int hash_key = 0;
int ZOB_TABLE[67][64];

// ------------------------------ BITBOARD ------------------------------

#define get_bit(bitboard, i) ((bitboard) & (1ULL << (i)))
#define set_bit(bitboard, i) (bitboard |= (1ULL << i))
#define pop_bit(bitboard, i) ((bitboard) &= ~(1ULL << (i)))

int count_bits(U64 bitboard) {
    bitboard -= (bitboard >> 1) & 0x55555555;
    bitboard = (bitboard & 0x33333333) + ((bitboard >> 2) & 0x33333333);
	return ((bitboard + (bitboard >> 4) & 0xF0F0F0F) * 0x0101010101010101) >> 56;
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
int get_move_source(int move) { return move & 63; }
int get_move_target(int move) { return (move & 4032) >> 6; }
int get_move_piece(int move) { return (move & 61440) >> 12; }
int get_move_promote(int move) { return (move & 983040) >> 16; }
int get_move_capture(int move) { return (move & 1048576) >> 20; }
int get_move_double(int move) { return (move & 2097152) >> 21; }
int get_move_enpassant(int move) { return (move & 4194304) >> 22; }
int get_move_castle(int move) { return (move & 8388608) >> 23; }
string get_move_desc(int move, vector<int> all_moves = {}) { // all_moves for specific desc, eg. Nbg4
    int move_source = get_move_source(move);
    int move_target = get_move_target(move);
    int move_piece = get_move_piece(move);

    // Check castle moves
    if (get_move_castle(move)) {
        if (PLAYER_WHITE ^ (move_source > move_target)) {
        // if ((PLAYER_WHITE && move_source < move_target) || (!PLAYER_WHITE && move_source > move_target)) { // kingside
            return "O-O";
        }
        return "O-O-O";
    }

    string pieces = "NBRQK";
    string letters = "abcdefgh";
    int srow = move_source >> 3; int scol = move_source % 8;
    int trow = move_target >> 3; int tcol = move_target % 8;

    if (PLAYER_WHITE) {
        trow = 7 - trow;
    } else {
        letters = "hgfedcba";
    }

    string res;
    if (move_piece % 6) { 
        res = pieces[move_piece % 6 - 1]; 
    }

    // Disambiguate moves for pgn eg. Nge2
    for (int i = 0; i < all_moves.size(); i++) {
        // Not this move, same piece not pawn, same target square
        int other_move = all_moves[i];
        if (move != other_move && move_piece == get_move_piece(other_move) && move_piece % 6 != 0 && move_target == get_move_target(other_move)) {
            if (scol == get_move_source(other_move) % 8) { // use numbers
                if (PLAYER_WHITE) {
                    res.append(to_string(8 - srow));
                } else {
                    res.append(to_string(srow + 1));
                }
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
        if (!pieces[move_promote]) {
            res.push_back('Q'); 
        } else {
            res.push_back(pieces[move_promote]); 
        }
    }
    return res;
}

// ------------------------------ CASTLE ------------------------------

/*
    Encoding
    0001    player king
    0010    player queen
    0100    ai king
    1000    ai queen
*/

int create_castle(vector<int> array = {1, 1, 1, 1}) {
    return (array[0]) | (array[1] << 1) | (array[2] << 2) | (array[3] << 3);
}

int update_castle(int &castle, int source, int target) {
    if (!PLAYER_WHITE) {
        source += 7 - 2 * (source % 8); // flip cols
        target += 7 - 2 * (target % 8); // flip cols
    }
    hash_key ^= ZOB_TABLE[65][castle];
    castle &= CASTLING_RIGHTS[source];
    castle &= CASTLING_RIGHTS[target];
    hash_key ^= ZOB_TABLE[65][castle];
    return castle;
}

int get_castle_pk(int castle) { return castle & 1; }
int get_castle_pq(int castle) { return (castle & 2) >> 1; }
int get_castle_ak(int castle) { return (castle & 4) >> 2; }
int get_castle_aq(int castle) { return (castle & 8) >> 3; }
void print_castle(int castle) {
    printf("%s\n", to_string(get_castle_pk(castle)) + " " + to_string(get_castle_pq(castle)) + ", " + to_string(get_castle_ak(castle)) + " " + to_string(get_castle_aq(castle)));
}

// ------------------------------ BOARD ------------------------------

// ------------------------------ MAIN ------------------------------

int main() {
    // string move_desc = get_move_desc(2099248);
    // printf("%s\n", move_desc.c_str());

    U64 b3 = 6ULL;

    printf("%llu\n", b3);
    print_bitboard(b3);

    printf("%d\n", count_bits(b3));
    printf("%d\n", lsb_index(b3));

    printf("%llu\n", get_bit(b3, 3));
    printf("%llu\n", get_bit(b3, 4));

    // printf("%llu\n", get_bit(b3, 4));

    return 0;
}