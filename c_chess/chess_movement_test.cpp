#include <iostream>
#include <cstdlib>

/* 
 * WHOLE BOARD
 * 0  1   ... 20
 * 21 22  ... 41
 * .          .
 * .          .
 * 400    ... 421
 * 
 * CHESS BOARD
 * 44 45  ... 60
 * 65 66  ... 81
 * .          .
 * .          .
 * 212    ... 228
 *
 * CHESS SQUARES
 * 66  68  ... 80
 * 108 110 ... 122
 * .           .
 * .           .
 * 360 362 ... 374
 */

const int STEPS_PER_REV = 200;

const int SIZE = 21;
const int HOME = 0;

/*
 * For promotion, at least reserve first 2 capture squares for Q N
 * 64 + 2 = 66 RFID readers min
 */
const int reserved_captures[2] = {
  40, 38
};
const int ai_captures[16] = {
  36, 34, 32, 30, 28, 26, 24, 22,
  64, 106, 148, 190, 232, 274
};
int ai_capture_count = 0;

int read_pos(int pos) {
  // TODO: return piece at position by reading RFID
  return 0;
}

void toggle_magnet() {
  // TODO: toggle magnet on/off
}

void print_values(int* values) {
    int max = 2;
    for (int i = 0; i < SIZE; i++) {
        for (int j = 0; j < SIZE; j++) {
            int p = SIZE * i + j;
            
            char c = '-';
            
            if (p / SIZE % 2 == 1 && p % SIZE % 2 == 1) {
                c = '&';
            }

            int v[4] = { 0, 1, 19, 20 };
            for (int k = 0; k < 4; k++) {
                if (p / SIZE == v[k] || p % SIZE == v[k]) {
                    c = '+';
                    break;
                }
            }
            int num = 0;
            for (int k = 0; k < max; k++) {
                if (p == values[k]) {
                    printf("%d ", k);
                    num = 1;
                    break;
                }
            }
            if (!num) {
                printf("%c ", c);
            }
        }
        printf("\n");
    }
    printf("\n");
}

void navigate(int source, int target) {
  int x = target % SIZE - source % SIZE;
  int y = target / SIZE - source / SIZE;
  // TODO: activate stepper motors
  int arr[2] = { source, target }; 
  print_values(arr);
}

int navigate_carry(int source, int target, int fast_move=1) {
  toggle_magnet();

  int next_pos; // TODO: square after target, where captured piece would be pushed to
  if (fast_move) {
    navigate(source, target);

    int axis = abs(target - source) % SIZE ? 1 : SIZE;
    int dir = target > source ? 1 : -1;
    next_pos = target + dir * axis;
  } 
  else { // move captured piece / knight move / rook castle move
    int source_row = source / SIZE;
    int source_col = source % SIZE;
    int target_row = target / SIZE;
    int target_col = target % SIZE;

    int row_diff = abs(target_row - source_row);
    int col_diff = abs(target_col - source_col);
    int row_direction = target_row > source_row ? 1 : -1;
    int col_direction = target_col > source_col ? 1 : -1;

    int keys[2] = {col_direction, row_direction * row_diff * SIZE};
    if ((source_row % 2 && !(source_col % 2)) || row_diff <= 2) {
        keys[0] = row_direction * SIZE;
        keys[1] = col_direction * col_diff;
    }
    int last = source;
    if (source_row % 2 && source_col % 2 && row_diff > 2 && col_diff > 2) {
        navigate(source, source + keys[0]);
        last += keys[0];
    }
    int target_rail = target - keys[0];
    int vertex = target_rail - keys[1];
    navigate(last, vertex);
    navigate(vertex, target_rail);
    navigate(target_rail, target);

    next_pos = (target << 1) - target_rail;
  }  
  toggle_magnet();
  return next_pos;
}

void do_move(int turn, int source, int target, int piece, int capture=0, int castle=0, int promote=0, int enpassant=0) {  
  // Chess square to board square
  // 42 * (square / 8) + 66 + 2 * (square % 8)
  int source_pos = 42 * (source >> 3) + 66 + ((source % 8) << 1);
  int target_pos = 42 * (target >> 3) + 66 + ((target % 8) << 1);
  
//   int piece = read_pos(source_pos);
  int capture_piece = 0; // read_pos(target_pos);

  navigate(HOME, source_pos);
  int capture_pos;

  if (capture && abs((target >> 3) - (source >> 3)) == abs((target % 8) - (source % 8))) {
    // Diagonal capture. Move diagonally close, then zigzag to capture
    int opp_r_dir = (target >> 3) > (source >> 3) ? -1 : 1;
    int opp_c_dir = (target % 8) > (source % 8) ? -1 : 1;
    
    int pause_pos = target_pos + opp_c_dir + SIZE * opp_r_dir;
    navigate_carry(source_pos, pause_pos);
    capture_pos = navigate_carry(pause_pos, target_pos, 0);
  } else {
    capture_pos = navigate_carry(source_pos, target_pos, piece != 2);
  }
  int last_location = target_pos;
    
  if (capture) {
    if (enpassant) {
      capture_pos = turn ? target_pos + SIZE : target_pos - SIZE;
    }
    navigate(last_location, capture_pos); 
    
    if (capture_piece == 5 && !read_pos(reserved_captures[0])) { // put queen in reserved spot
      last_location = reserved_captures[0];
    } else if (capture_piece == 2 && !read_pos(reserved_captures[1])) { // put knight in reserved spot
      last_location = reserved_captures[1];
    } else {
      last_location = ai_captures[ai_capture_count];
      ai_capture_count++;
    }
    navigate_carry(capture_pos, last_location, 0);
  } 
  else if (castle) {
    if (target == 6) {
      navigate(last_location, 80);
      navigate_carry(80, 76, 0); // 7 -> 5
      last_location = 76;
    } else if (target == 2) {
      navigate(last_location, 66);
      navigate_carry(66, 72, 0); // 0 -> 3
      last_location = 72;
    }
  }
  if (promote) {
    navigate_carry(last_location, ai_captures[ai_capture_count], 0);
    ai_capture_count++;

    int promote_pos = (promote == 2) ? reserved_captures[1] : reserved_captures[0]; // TODO: currently promote to Q N only
    navigate(ai_captures[ai_capture_count - 1], promote_pos);
    navigate_carry(promote_pos, target_pos, 0);
    last_location = target_pos;
  }
  
  navigate(last_location, HOME);
  printf("\n\n-----------------------------------------------------------------------------------------------------------------------\n\n");
}

int md[12][7] = {
    4, 6, 11, 0, 1, 0, 0, // O-O

    35, 18, 1, 1, 0, 0, 0,  // Nxc6
    45, 21, 4, 1, 0, 0, 0,  // Qxf6
    35, 20, 1, 1, 0, 0, 0,  // Nxe6
    45, 36, 4, 1, 0, 0, 0,  // Qxe4
    45, 27, 4, 1, 0, 0, 0,  // Qxd5
    61, 25, 2, 0, 0, 0, 0,  // Bb5
// };

    14, 7, 2, 1, 0, 0, 0, // bx
    6, 7, 3, 1, 0, 0, 0, // Rx
    9, 0, 0, 1, 0, 5, 0, // px=Q
    5, 15, 1, 1, 0, 0, 0, // Nx
    9, 1, 0, 0, 0, 2, 0, // p=N
};

int main(int argc, char *argv[]) {
    int i = 0;
    if (argc > 1) { i = atoi(argv[1]); }
    do_move(0, md[i][0], md[i][1], md[i][2] + 1, md[i][3], md[i][4], md[i][5], md[i][6]);
    
    return 0;
}
