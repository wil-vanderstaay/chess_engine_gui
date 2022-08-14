// MOVE ----------------------------------------------------------------------------------------------------------------------
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
function create_move(source, target, piece, promote=0, capture=0, double=0, enpassant=0, castle=0) {
    return (source) | (target << 6) | (piece << 12) | (promote << 16) | (capture << 20) | (double << 21) | (enpassant << 22) | (castle << 23);
}
function print_move(move) {
    let pieces = "PRNBQKprnbqk";
    let res = pieces[get_move_piece(move)] + " " + get_move_source(move) + " -> " + get_move_target(move);
    if (get_move_capture(move)) { res += " X"; }
    if (get_move_promote(move)) { res += " P"; }
    if (get_move_double(move)) { res += " D"; }
    if (get_move_enpassant(move)) { res += " E"; }
    if (get_move_castle(move)) { res += " C"; }
    console.log(res);
}
function get_move_source(move) { return move & 63; }
function get_move_target(move) { return (move & 4032) >> 6; }
function get_move_piece(move) { return (move & 61440) >> 12; }
function get_move_promote(move) { return (move & 983040) >> 16; }
function get_move_capture(move) { return (move & 1048576) >> 20; }
function get_move_double(move) { return (move & 2097152) >> 21; }
function get_move_enpassant(move) { return (move & 4194304) >> 22; }
function get_move_castle(move) { return (move & 8388608) >> 23; }
function get_move_desc(move, all_moves) { // all_moves for specific desc, eg. Nbg4
    let move_source = get_move_source(move);
    let move_target = get_move_target(move);

    // Check castle moves
    if (get_move_castle(move)) {
        if ((PLAYER_WHITE && move_source < move_target) || (!PLAYER_WHITE && move_source > move_target)) { // kingside
            return "O-O";
        }
        return "O-O-O";
    }

    let pieces = ["", "R", "N", "B", "Q", "K", "", "R", "N", "B", "Q", "K"];
    let letters = "abcdefgh";
    let srow = move_source / 8 >> 0; let scol = move_source % 8;
    let trow = move_target / 8 >> 0; let tcol = move_target % 8;

    if (PLAYER_WHITE) {
        trow = 7 - trow;
    } else {
        letters = "hgfedcba";
    }

    let res = pieces[get_move_piece(move)]; // piece letter

    // Disambiguate moves for pgn eg. Nge2
    if (all_moves != null) {
        for (let i = 0; i < all_moves.length; i++) {
            // Not this move, same piece not pawn, same target square
            let other_move = all_moves[i];
            if (move != other_move && get_move_piece(move) == get_move_piece(other_move) && get_move_piece(move) % 6 != 0 && move_target == get_move_target(other_move)) {
                if (scol == get_move_source(other_move) % 8) { // use numbers
                    if (PLAYER_WHITE) {
                        res += (8 - srow);
                    } else {
                        res += (srow + 1);
                    }
                } else { // use letters
                    res += letters[scol];
                }
            }
        }
    }

    // Check capture moves
    if (get_move_capture(move)) { 
        if (!res.length) { res += letters[scol]; } // pawn capture
        res += "x";
    }
    res += (letters[tcol]) + (trow + 1); // move notation

    // Check promotion moves
    let move_promote = get_move_promote(move);
    if (move_promote) { 
        if (!pieces[move_promote]) {
            res += "=Q"; 
        } else {
            res += "=" + pieces[move_promote]; 
        }
    }
    return res;
}

// CASTLE ----------------------------------------------------------------------------------------------------------------------
/*
    Encoding
    0001    player king
    0010    player queen
    0100    ai king
    1000    ai queen
*/
function create_castle(array=[1,1,1,1]) {
    return (array[0]) | (array[1] << 1) | (array[2] << 2) | (array[3] << 3);
}
let CASTLING_RIGHTS = [
    7, 15, 15, 15,  3, 15, 15, 11,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    13, 15, 15, 15, 12, 15, 15, 14
];
function update_castle(castle, source, target) {
    if (!PLAYER_WHITE) {
        source += 7 - 2 * (source % 8); // flip cols
        target += 7 - 2 * (target % 8); // flip cols
    }
    hash_key = xor_bitboards(hash_key, ZOB_TABLE[65][castle]);
    castle &= CASTLING_RIGHTS[source];
    castle &= CASTLING_RIGHTS[target];
    hash_key = xor_bitboards(hash_key, ZOB_TABLE[65][castle]);
    return castle;
}

function print_castle(castle) {
    console.log(get_castle_pk(castle) + " " + get_castle_pq(castle) + ", " + get_castle_ak(castle) + " " + get_castle_aq(castle));
}
function get_castle_pk(castle) { return castle & 1; }
function get_castle_pq(castle) { return (castle & 2) >> 1; }
function get_castle_ak(castle) { return (castle & 4) >> 2; }
function get_castle_aq(castle) { return (castle & 8) >> 3; }
    
// BITBOARD ----------------------------------------------------------------------------------------------------------------------

function not_bitboard(bitboard) {
    return [~bitboard[0], ~bitboard[1]];
}
function neg_bitboard(bitboard) {
    let nf = -bitboard[0]; let nl = -bitboard[1];
    if (!nl) { nl = 4294967295; }
    if (!nf) { nf = 4294967295; } else { nl = 0; } // don't isolate last32
    return [nf, nl];
}
function minus1_bitboard(bitboard) {
    if (bitboard[0]) {
        return [bitboard[0] - 1, bitboard[1]];
    }
    return [4294967295, bitboard[1] - 1];
}
function bool_bitboard(bitboard) {
    return bitboard[0] || bitboard[1];
}
function copy_bitboard(bitboard) {
    return [bitboard[0], bitboard[1]];
}
function print_bitboard(bitboard) {
    let res = new Array(8);
    for (let i = 0; i < 8; i++) {
        res[i] = new Array(8);
    }
    for (let i = 0; i < 64; i++) {
        res[i / 8 << 0][i % 8] = get_bit(bitboard, i) ? 1 : 0;
    }
    console.log(res);
}

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
    return and_bitboards(bitboard1, not_bitboard(bitboard2));
}
// function equal_bitboards(bitboard1, bitboard2) {
//     return bitboard1[0] == bitboard2[1] && bitboard1[1] == bitboard2[1];
// }

function get_bit(bitboard, i) {
    if (i < 32) { 
        return bitboard[0] & (1 << i); 
    }
    return bitboard[1] & (1 << i);
}
function set_bit(bitboard, i) {
    if (i < 32) {
        bitboard[0] |= (1 << i);
    } else {
        bitboard[1] |= (1 << i);
    }
}
function pop_bit(bitboard, i) {
    let bit = get_bit(bitboard, i);
    if (bit) {
        if (i < 32) {
            bitboard[0] ^= (1 << i); 
        } else {
            bitboard[1] ^= (1 << i); 
        }
    }
    return bit;
}

function count_bits(bitboard) {
    let res = 0;
    while (bitboard[0] != 0 || bitboard[1] != 0) {
        res++;
        bitboard = and_bitboards(bitboard, minus1_bitboard(bitboard));
    }
    return res;
}
function lsb_index(bitboard) {
    return count_bits(minus1_bitboard(and_bitboards(bitboard, neg_bitboard(bitboard))));
}

function bool_bitboard(bitboard) {
    return bitboard[0] || bitboard[1];
}
function copy_bitboard(bitboard) {
    return [bitboard[0], bitboard[1]];
}
function print_bitboard(bitboard) {
    let res = new Array(8);
    for (let i = 0; i < 8; i++) {
        res[i] = new Array(8);
    }
    for (let i = 0; i < 64; i++) {
        res[i / 8 << 0][i % 8] = get_bit(bitboard, i) ? 1 : 0;
    }
    console.log(res);
}

// BOARD ----------------------------------------------------------------------------------------------------------------------
/*
    12 piece bitboards, 3 occupancies
    player, ai
    pawn, rook, knight, bishop, queen, king
*/
function create_board(board) {
    let res = new Array(15);
    for (let i = 0; i < res.length; i++) {
        res[i] = [0, 0];
    }
    for (let i = 0; i < 64; i++) { // pieces
        let piece = board[i];
        if (piece) {
            set_bit(res[piece - 1], i);
        }
    }
    for (let i = 0; i < 6; i++) { // player
        res[12] = or_bitboards(res[12], res[i]);
    }
    for (let i = 6; i < 12; i++) { // ai
        res[13] = or_bitboards(res[13], res[i]);
    }
    res[14] = or_bitboards(res[12], res[13]); // board
    return res;
}
function copy_board(board) {
    let res = [];
    for (let i = 0; i < board.length; i++) {
        res.push(copy_bitboard(board[i]));
    }
    return res;
}

function legal_move(pos, new_pos) {
    let moves = generate_pseudo_moves();
    if (!moves.length) {
        return [moves, finish()];
    }
    for (let i = 0; i < moves.length; i++) {
        let move = moves[i];
        if (get_move_source(move) == pos && get_move_target(move) == new_pos) {
            return [moves, move];
        }
    }
    return [moves, false];
}

function print_board(board, display=1) {
    let res = [];
    for (let i = 0; i < 8; i++) {
        let row = [];
        for (let j = 0; j < 8; j++) {
            let k = 8 * i + j;
            let char = " ";
            if (get_bit(board[14], k)) {
                if (get_bit(board[12], k)) {
                    if (get_bit(board[0], k)) {
                        char = "p";
                    } else if (get_bit(board[1], k)) {
                        char = "r";
                    } else if (get_bit(board[2], k)) {
                        char = "n";
                    } else if (get_bit(board[3], k)) {
                        char = "b";
                    } else if (get_bit(board[4], k)) {
                        char = "q";
                    } else if (get_bit(board[5], k)) {
                        char = "k";
                    }
                    if (PLAYER_WHITE) {
                        char = char.toUpperCase();
                    }
                } else if (get_bit(board[13], k)) {
                    if (get_bit(board[6], k)) {
                        char = "p";
                    } else if (get_bit(board[7], k)) {
                        char = "r";
                    } else if (get_bit(board[8], k)) {
                        char = "n";
                    } else if (get_bit(board[9], k)) {
                        char = "b";
                    } else if (get_bit(board[10], k)) {
                        char = "q";
                    } else if (get_bit(board[11], k)) {
                        char = "k";
                    }
                    if (!PLAYER_WHITE) {
                        char = char.toUpperCase();
                    }
                }
            }
            row.push(char);
        }
        res.push(row);
    }
    if (display) {
        console.log(res);
        console.log();
    } else {
        return res;
    }
}

function do_move(move) {
    if (!move) { return 0; }

    let cb = copy_board(BOARD);
    let cc = CASTLE;
    let ce = EN_PASSANT_SQUARE;
    let ch = copy_bitboard(hash_key);

    let source = get_move_source(move);
    let target = get_move_target(move);
    let piece = get_move_piece(move);

    // Move piece
    pop_bit(BOARD[piece], source);
    set_bit(BOARD[piece], target);
    hash_key = xor_bitboards(hash_key, ZOB_TABLE[source][piece]);
    hash_key = xor_bitboards(hash_key, ZOB_TABLE[target][piece]);

    if (get_move_capture(move)) {
        for (let i = 6 * (TURN ^ 1); i < 6 * (TURN ^ 1) + 6; i++) {
            if (get_bit(BOARD[i], target)) {
                pop_bit(BOARD[i], target);
                hash_key = xor_bitboards(hash_key, ZOB_TABLE[target][i]);
                break;
            }
        }
    }

    if (get_move_promote(move)) {
        let promote_piece = get_move_promote(move);
        if (promote_piece == 15) {
            let input = window.prompt("R N B Q: ").toUpperCase();
            let value = { "R": 1, "N": 2, "B": 3, "Q": 4 };
            if (!Object.keys(value).includes(input)) { input = "Q"; }
            promote_piece = piece + value[input];
        }
        pop_bit(BOARD[piece], target);
        set_bit(BOARD[promote_piece], target);
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[target][piece]);
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[target][promote_piece]);

    } else if (get_move_enpassant(move)) {
        if (TURN) {
            pop_bit(BOARD[0], target - 8);
            hash_key = xor_bitboards(hash_key, ZOB_TABLE[target - 8][0]);
        } else {
            pop_bit(BOARD[6], target + 8);
            hash_key = xor_bitboards(hash_key, ZOB_TABLE[target + 8][6]);
        }

    } else if (get_move_castle(move)) {
        if (PLAYER_WHITE) {
            switch(target) {
                case 62: // pk
                    pop_bit(BOARD[1], 63);
                    set_bit(BOARD[1], 61);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[63][1]);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[61][1]);
                    break;
                case 58: // pq
                    pop_bit(BOARD[1], 56);
                    set_bit(BOARD[1], 59);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[56][1]);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[59][1]);
                    break;
                case 6: // ak
                    pop_bit(BOARD[7], 7);
                    set_bit(BOARD[7], 5);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[7][7]);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[5][7]);
                    break;
                case 2: // aq
                    pop_bit(BOARD[7], 0);
                    set_bit(BOARD[7], 3);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[0][7]);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[3][7]);
                    break;
            }
        } else {
            switch(target) {
                case 57: // pk
                    pop_bit(BOARD[1], 56);
                    set_bit(BOARD[1], 58);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[56][1]);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[58][1]);
                    break;
                case 61: // pq
                    pop_bit(BOARD[1], 63);
                    set_bit(BOARD[1], 60);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[63][1]);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[60][1]);
                    break;
                case 1: // ak
                    pop_bit(BOARD[7], 0);
                    set_bit(BOARD[7], 2);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[0][7]);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[2][7]);
                    break;
                case 5: // aq
                    pop_bit(BOARD[7], 7);
                    set_bit(BOARD[7], 4);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[7][7]);
                    hash_key = xor_bitboards(hash_key, ZOB_TABLE[4][7]);
                    break;
            }
        }
    } 
    
    if (EN_PASSANT_SQUARE) {
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[66][EN_PASSANT_SQUARE]);
    }
    EN_PASSANT_SQUARE = null;
    if (get_move_double(move)) {
        if (TURN) {
            EN_PASSANT_SQUARE = target - 8;
        } else {
            EN_PASSANT_SQUARE = target + 8;
        }
        hash_key = xor_bitboards(hash_key, ZOB_TABLE[66][EN_PASSANT_SQUARE]);   
    }

    CASTLE = update_castle(CASTLE, source, target);

    // Update occupancies
    BOARD[12] = [0, 0];
    BOARD[13] = [0, 0];
    for (let i = 0; i < 6; i++) { // player
        BOARD[12] = or_bitboards(BOARD[12], BOARD[i]);
    }
    for (let i = 6; i < 12; i++) { // ai
        BOARD[13] = or_bitboards(BOARD[13], BOARD[i]);
    }
    BOARD[14] = or_bitboards(BOARD[12], BOARD[13]); // board

    // Moving into check, reset state
    if (is_square_attacked(TURN ? lsb_index(BOARD[11]) : lsb_index(BOARD[5]), TURN ^ 1)) {
        BOARD = cb;
        CASTLE = cc;
        EN_PASSANT_SQUARE = ce;
        hash_key = ch;
        return 0;
    }
    TURN ^= 1;
    hash_key = xor_bitboards(hash_key, ZOB_TABLE[64]);
    return 1;
}

// HTML BOARD ----------------------------------------------------------------------------------------------------------------------

function display_board(last_move) {
    GAME.push(copy_board(BOARD));
    if (!TURN) {
        if (PLAYER_WHITE) { document.getElementById("move_number").innerHTML = "Move number: " + (MOVE_NUMBER); }
        else { MOVE_NUMBER++; }
    } else {
        if (!PLAYER_WHITE) { document.getElementById("move_number").innerHTML = "Move number: " + (MOVE_NUMBER); }
        else { MOVE_NUMBER++; }
    }

    let table = document.getElementById("chess-table");
    for (let i = 0; i < 64; i++) {
        let piece_location = table.rows.item(i / 8 >> 0).cells.item(i % 8 + 1);
        piece_location.style.background = (piece_location.className == "light") ? "#f1d9c0" : "#a97a65";
        for (let j = 0; j < 12; j++) {
            piece_location.innerHTML = "";
            if (get_bit(BOARD[j], i)) {
                if (!PLAYER_WHITE) {
                    j = 6 * (1 - (j / 6 >> 0)) + j % 6;
                }
                let piece = '<img draggable="false" style="width: 70px; height: 70px;" src="../chess_piece_images/' + (j) + '.png">';
                piece_location.innerHTML = '<div id="' + (i) + '" class="chess-piece">' + piece + '</div>';
                piece_movement(document.getElementById((i)), i);
                break;
            }
        }
    }

    if (get_move_piece(last_move) >= 6) {
        let lcode = "#B8E2F2"; let dcode = "#77C3EC";

        let move_source = get_move_source(last_move);
        let move_target = get_move_target(last_move);

        let s_location = table.rows.item(move_source / 8 >> 0).cells.item(move_source % 8 + 1);
        let t_location = table.rows.item(move_target / 8 >> 0).cells.item(move_target % 8 + 1);

        s_location.style.background = (s_location.className == "light") ? lcode: dcode;
        t_location.style.background = (t_location.className == "light") ? lcode : dcode;
    }

    if (TURN) { // ai turn
        let res = search(LOOKAHEAD);
        let evaluation = res[0]; let time = res[1]; let moves = res[2];
        let best_move = pv_table[0][0];

        if (!do_move(best_move)) {
            return finish();
        }

        // Print search details
        document.getElementById("analysed").value = (COUNT);
        document.getElementById("depth_input").value = (LOOKAHEAD);
        document.getElementById("time").value = (time) + " ms";
        document.getElementById("move").value = get_move_desc(best_move, moves);

        if (PLAYER_WHITE) { 
            evaluation *= -1;
        }
        GAME_MOVES.push(document.getElementById("move").value);

        evaluation = Math.round(evaluation + Number.EPSILON);
        if (evaluation < -99900) {
            if (evaluation == -99999) { setTimeout(() => {  return finish(); }, 250); }
            evaluation = "-M" + ((99999 + evaluation) / 2 << 0);
        } else if (evaluation > 99900) {
            if (evaluation == 99999) { setTimeout(() => {  return finish(); }, 250); }
            evaluation = "M" + ((99999 - evaluation + 1) / 2 << 0);
        }

        document.getElementById("evaluation").value = evaluation / 100;
        showLines();         

        if (!DISABLE_LOOKAHEAD) {
            if (!time) {
                // book move
            } else if (time < 750) { // under 0.5s, INCREASE
                LOOKAHEAD_COUNT = 2;
            } else if (time < 1500) {
                LOOKAHEAD_COUNT++;
            } else if (time > 15000) { // over 15s, DECREASE
                LOOKAHEAD_COUNT = -2;
            } else if (time > 7500) {
                LOOKAHEAD_COUNT--;
            }

            if (LOOKAHEAD_COUNT >= 2) { // 2 fast moves
                LOOKAHEAD++;
                LOOKAHEAD_COUNT = 0;
            } else if (LOOKAHEAD_COUNT <= -2) { // 2 slow moves
                LOOKAHEAD--;
                LOOKAHEAD_COUNT = 0
            }
        }

        let gamephase_score = get_gamephase_score();
        if (gamephase_score > opening_phase) { GAMEPHASE = 0; }
        else if (gamephase_score < endgame_phase) { GAMEPHASE = 2; }
        else { GAMEPHASE = 1; }

        display_board(best_move);


    }    
}

function piece_movement(div, pos) {
    let min_left = 34; let min_top = 14; let width = 84;
    let pos1 = 0; let pos2 = 0; let pos3 = 0; let pos4 = 0;
    let selected = false;
    let flashing = false;

    let down_function = dragMouseDown;
    if (TURN == 2 || (TURN && get_bit(BOARD[12], pos)) || (!TURN && get_bit(BOARD[13], pos))) {
        down_function = null;
    }
    div.onmousedown = down_function;
    setPosition();

    function setPosition(position=-1) {
        // Move piece to centre of tile
        rem_top = (div.offsetTop - min_top) % width;
        rem_left = (div.offsetLeft - min_left) % width;
        if (rem_top > width/2) {
            rem_top -= width;
        }
        if (rem_left > width/2) {
            rem_left -= width;
        }
        div.style.top = (div.offsetTop - rem_top) + "px";
        div.style.left = (div.offsetLeft - rem_left) + "px";

        if (position > -1 && position != pos) {
            let target_div = document.getElementById((position));
            if (target_div) {
                target_div.innerHTML = "";
            }
        }
    }

    function flash() {
        flashing = true;
        document.getElementById("chess-table").rows.item(pos / 8 >> 0).cells.item(pos % 8 + 1).style.background = "#FF0000"; // RED
        setTimeout(() => {  
            flashing = false;
            display_board(); 
        }, 250);
    }
    
    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        div.style.top = (div.offsetTop - pos2) + "px";
        div.style.left = (div.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        setPosition();

        let new_row = (div.offsetTop - min_top) / width;
        let new_col = (div.offsetLeft - min_left) / width;
        let new_pos = 8 * new_row + new_col;

        setPosition(new_pos);
        if (new_pos != pos) { 
            doLegalMove(new_pos);
        } else {
            clickShowMoves();
        }
    }

    function clickShowMoves() {
        selected = !selected
        let table = document.getElementById("chess-table");

        // Reset other coloured cells
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (8 * i + j != pos || !selected) {
                    let cell = table.rows.item(i).cells.item(j + 1);
                    cell.style.background = (cell.className == "light") ? "#f1d9c0" : "#a97a65";
                    cell.onclick = null;
                }
            }
        }

        if (selected && !flashing) {
            // Determine legal piece moves
            let moves = generate_pseudo_moves();
            let piece_moves = [];
            for (let i = 0; i < moves.length; i++) {
                if (get_move_source(moves[i]) == pos) {
                    piece_moves.push(moves[i]);
                }
            }

            // Highlight legal piece moves
            for (let i = 0; i < piece_moves.length; i++) {
                let target = get_move_target(piece_moves[i]);
                let move_location = table.rows.item(target/ 8 >> 0).cells.item(target % 8 + 1);
                move_location.style.background = (move_location.className == "light") ? "#bbe0ae" : "#75c15b";

                move_location.onclick = function() {
                    doLegalMove(target);
                    move_location.onclick = null;
                }
            }
        }
    }

    function doLegalMove(target) {
        let res = legal_move(pos, target);
        let moves = res[0]; let move = res[1];
        if (move) {
            if (get_move_promote(move)) { // ask for promote input
                move |= 983040; // set promote 15
            }
            if (do_move(move)) {
                GAME_MOVES.push(get_move_desc(move, moves));

                div.onmousedown = null;

                let message = "LOADING";
                let res = "";
                for (let i = 0; i < message.length; i++) {
                    res += "<h1>" + message[i] + "</h1><br>";
                }
                document.getElementById("loading").innerHTML = res.slice(0, res.length - 4);
                
                setTimeout(() => {  
                    document.getElementById("loading").innerHTML = "";
                    display_board(move); 
                }, 250);
            } else {
                flash();
            }
        } else {
            flash();    
        }
    }
}

// INITIALISE BOARD ----------------------------------------------------------------------------------------------------------------------

function make_table() {
    let table = '<table id="chess-table" class="chess-board">';
    for (let row = 0; row < 8; row++) {
        if (PLAYER_WHITE) {
            table += '<tr><th>' + (8 - row).toString() + '</th>'; 
        } else {
            table += '<tr><th>' + (row + 1).toString() + '</th>';  
        }
        for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 == 1) {
                colour_class = 'dark';    
            } else {
                colour_class = 'light';
            }
            table += '<td class="' + colour_class + '"></td>';
        }
        table += '</tr>';
    }
    if (PLAYER_WHITE) {
        table += '<th></th><th>a</th><th>b</th><th>c</th><th>d</th><th>e</th><th>f</th><th>g</th><th>h</th></table>';
    } else {
        table += '<th></th><th>h</th><th>g</th><th>f</th><th>e</th><th>d</th><th>c</th><th>b</th><th>a</th></table>';
    }

    document.getElementById("chess-board").innerHTML = table;
}

function flip_fen(fen) {
    let res = "";
    let i = 0;
    while (i < fen.length) {
        let row = "";
        while (i < fen.length && fen[i] != "/" && fen[i] != " ") {
            row += fen[i];
            i++;
        }
        let rev_row = "";
        for (let j = row.length - 1; j >= 0; j--) {
            rev_row += row[j];
        }
        res = rev_row + res;
        if (fen[i] == " ") {
            // fen = "rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4";
            res += " " + fen[i + 1] + " ";
            if (fen[i + 3] != "-") {
                while (fen[i + 3] != " ") {
                    res += fen[i + 3];
                    i++;
                }
            } else { res += "-"; }
            res += " ";
            if (fen[i + 4] != "-") {
                let letters = {"a": "h", "b": "g", "c": "f", "d": "e", "f": "c", "g": "b", "h": "a"};
                res += letters[fen[i + 4]];
                let new_num = 9 - parseInt(fen[i + 5]);
                res += new_num.toString();
            } else { res += "-"; }
            res += " " + fen[fen.length - 3] + " " + fen[fen.length - 1];
            return res;
        } else {
            res = fen[i] + res;
        }
        i++;
    } 
    return res;
}

function make_board(fen) {
    function asList(array) {
        let res = [];
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                res.push(array[i][j]);
            }
        }
        return res;
    }
    let values;
    if (PLAYER_WHITE) {
        values = {
            P: 1,
            R: 2,
            N: 3,
            B: 4,
            Q: 5,
            K: 6,
    
            p: 7,
            r: 8,
            n: 9,
            b: 10,
            q: 11,
            k: 12,                   
        }
    } else {
        values = {
            P: 7,
            R: 8,
            N: 9,
            B: 10,
            Q: 11,
            K: 12,
    
            p: 1,
            r: 2,
            n: 3,
            b: 4,
            q: 5,
            k: 6,                   
        }
        fen = flip_fen(fen);
    }

    let res = new Array(8);
    for (let i = 0; i < 8; i++) {
        res[i] = new Array(8).fill(0);
    }

    let curr_row = 0;
    let curr_col = 0;

    for (let i = 0; i < fen.length; i++) {
        let char = fen[i];
        if (char == " ") {
            let castle = [0, 0, 0, 0];
            let j = 3;
            while (fen[i + j] != " ") {
                if (fen[i + j] == "K") {
                    castle[0] = 1;
                } else if (fen[i + j] == "Q") {
                    castle[1] = 1;
                } else if (fen[i + j] == "k") {
                    castle[2] = 1;
                } else if (fen[i + j] == "q") {
                    castle[3] = 1;
                }
                j++;
            }
            if (fen[i + j + 1] != "-") {
                EN_PASSANT_SQUARE = 8 * (8 - parseInt(fen[i + j + 2])) + fen[i + j + 1].charCodeAt() - 97;
                if (!PLAYER_WHITE) {
                    EN_PASSANT_SQUARE = 63 - EN_PASSANT_SQUARE;
                }
            }

            TURN = fen[i + 1] == "w" ? 0 : 1;

            if (!PLAYER_WHITE) {
                TURN ^= 1;
                let temp = castle[0];
                castle[0] = castle[2];
                castle[2] = temp;
                temp = castle[1];
                castle[1] = castle[3];
                castle[3] = temp;
            }
            CASTLE = create_castle(castle);
            return create_board(asList(res));

        } else if (char == "/") {
            curr_row++;
            curr_col = 0;
        } else if (!isNaN(char)) {
            curr_col += parseInt(char);
        } else {
            res[curr_row][curr_col] = values[char];
            curr_col++;
        }
    }
}

// DEFINE MOVES ----------------------------------------------------------------------------------------------------------------------

function initialiseConstants() {   
    PAWN_ATTACK = pawn_attack(); // [side][square]
    KNIGHT_ATTACK = knight_attack(); // [square]
    KING_ATTACK = king_attack(); // [square]

    function pawn_attack() {
        let res = [new Array(64), new Array(64)];
        for (let i = 0; i < 64; i++) { // player
            let board = [0, 0];           
            let col = i % 8;
            if (8 < i && 0 < col) { set_bit(board, i - 9); }
            if (6 < i && col < 7) { set_bit(board, i - 7); }
            res[0][i] = board;
        }
        for (let i = 0; i < 64; i++) { // ai
            let board = [0, 0]
            let col = i % 8;
            if (i < 57 && 0 < col) { set_bit(board, i + 7); }
            if (i < 55 && col < 7) { set_bit(board, i + 9); }
            res[1][i] = board;
        }
        return res;
    }
    function knight_attack() {
        let res = new Array(64);
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let i = 8 * r + c;
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
    function king_attack() {
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
}

function rook_attack_fly(square, blocker) {
    let res = [0, 0];
    let r = square / 8 >> 0; let c = square % 8;
    let o = 1;
    while (r + o < 8) { // + .
        let i = 8 * r + 8 * o + c;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= r - o) { // - .
        let i = 8 * r - 8 * o + c;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (c + o < 8) { // . +
        let i = 8 * r + c + o;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= c - o) { // . -
        let i = 8 * r + c - o;
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    return res; //.nand(occupancies[0]);
}
function bishop_attack_fly(square, blocker) {
    let res = [0, 0];
    let r = square / 8 >> 0; let c = square % 8;
    let o = 1;
    while (r + o < 8 && c + o < 8) { // + +
        let i = 8 * r + 9 * o + c; // 8(r+o) + (c+o) = 8r + 9o + c
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (r + o < 8 && 0 <= c - o) { // + -
        let i = 8 * r + 7 * o + c; // 8(r+o) + (c-o) = 8r + 7o + c
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= r - o && c + o < 8) { // - +
        let i = 8 * r - 7 * o + c; // 8(r-o) + (c+o) = 8r - 7o + c
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    o = 1;
    while (0 <= r - o && 0 <= c - o) { // - -
        let i = 8 * r - 9 * o + c; // 8(r-o) + (c-o) = 8r - 9o + c
        set_bit(res, i); o++;
        if (get_bit(blocker, i)) { break; }
    }
    return res; //.nand(occupancies[0]);
}
function queen_attack_fly(square, blocker) {
    return or_bitboards(bishop_attack_fly(square, blocker), rook_attack_fly(square, blocker));
}

function rook_attack(side) {
    let res = [0, 0];

    let rooks = copy_bitboard(BOARD[6 * side + 1]);
    while (bool_bitboard(rooks)) {
        let source = lsb_index(rooks);
        res = or_bitboards(res, rook_attack_fly(source, BOARD[14]));
        pop_bit(rooks, source);
    }
    return res;
}
function bishop_attack(side) {
    let res = [0, 0];

    let bishops = copy_bitboard(BOARD[6 * side + 3]);
    while (bool_bitboard(bishops)) {
        let source = lsb_index(bishops);
        res = or_bitboards(res, bishop_attack_fly(source, BOARD[14]));
        pop_bit(bishops, source);
    }
    return res;
}
function queen_attack(side) {
    let res = [0, 0];

    let queens = copy_bitboard(BOARD[6 * side + 4]);
    while (bool_bitboard(queens)) {
        let source = lsb_index(queens);
        res = or_bitboards(res, queen_attack_fly(source, BOARD[14]));
        pop_bit(queens, source);
    }
    return res;
}

// GENERATE MOVES ----------------------------------------------------------------------------------------------------------------------

function is_square_attacked(square, side) {
    // Attacked by player pawns
    if (!side && bool_bitboard(and_bitboards(PAWN_ATTACK[1][square], BOARD[0]))) { return 1; }
    // Attacked by ai pawns
    if (side && bool_bitboard(and_bitboards(PAWN_ATTACK[0][square], BOARD[6]))) { return 1; }
    // Attacked by rooks
    if (get_bit(rook_attack(side), square)) { return 2; }
    // Attacked by knights
    if (bool_bitboard(and_bitboards(KNIGHT_ATTACK[square], side ? BOARD[8] : BOARD[2]))) { return 3; }
    // Attacked by bishops
    if (get_bit(bishop_attack(side), square)) { return 4; }
    // Attacked by queens
    if (get_bit(queen_attack(side), square)) { return 5; }
    // Attacked by kings
    if (bool_bitboard(and_bitboards(KING_ATTACK[square], side ? BOARD[11] : BOARD[5]))) { return 6; }
    
    return 0;
}

function generate_pseudo_moves() {
    let moves = [];
    for (let i = 0; i < 6; i++) {
        let piece = 6 * TURN + i;
        let piece_board = copy_bitboard(BOARD[piece]);

        // Pawn moves
        if (i == 0) {
            while (bool_bitboard(piece_board)) {
                let source = lsb_index(piece_board);
                let target = source + [-1, 1][TURN] * 8;

                // Push
                if (0 <= target && target < 64 && !get_bit(BOARD[14], target)) {
                    let trow = target / 8 << 0;
                    if (trow == 0 || trow == 7) { // promotion
                        moves.push(create_move(source, target, piece, piece + 1)); // rook
                        moves.push(create_move(source, target, piece, piece + 2)); // knight
                        moves.push(create_move(source, target, piece, piece + 3)); // bishop
                        moves.push(create_move(source, target, piece, piece + 4)); // queen
                    } else {
                        // One square push
                        moves.push(create_move(source, target, piece));
                        // Two square push
                        let srow = source / 8 << 0;
                        if (srow == [6, 1][TURN] && !get_bit(BOARD[14], target + [-1, 1][TURN] * 8)) {
                            moves.push(create_move(source, target + [-1, 1][TURN] * 8, piece, 0, 0, 1));
                        }
                    }
                }

                // Capture
                let attacks = and_bitboards(PAWN_ATTACK[TURN][source], BOARD[12 + TURN ^ 1]);
                while (bool_bitboard(attacks)) {
                    let att = lsb_index(attacks);
                    let arow = att / 8 << 0;
                    if (arow == 0 || arow == 7) { // Promote
                        moves.push(create_move(source, att, piece, piece + 1, 1));
                        moves.push(create_move(source, att, piece, piece + 2, 1));
                        moves.push(create_move(source, att, piece, piece + 3, 1));
                        moves.push(create_move(source, att, piece, piece + 4, 1));
                    } else {
                        moves.push(create_move(source, att, piece, 0, 1));
                    }
                    pop_bit(attacks, att);

                }
                // En passant
                if (EN_PASSANT_SQUARE && get_bit(PAWN_ATTACK[TURN][source], EN_PASSANT_SQUARE)) {
                        moves.push(create_move(source, EN_PASSANT_SQUARE, piece, 0, 1, 0, 1));
                }

                // Pop
                pop_bit(piece_board, source);
            }
        }
        // Rook moves
        else if (i == 1) {
            while(bool_bitboard(piece_board)) {
                let source = lsb_index(piece_board);
                let attacks = nand_bitboards(rook_attack_fly(source, BOARD[14]), BOARD[12 + TURN]);
                while (bool_bitboard(attacks)) {
                    let att = lsb_index(attacks);
                    if (get_bit(BOARD[12 + TURN ^ 1], att)) {
                        moves.push(create_move(source, att, piece, 0, 1));
                    } else {
                        moves.push(create_move(source, att, piece));
                    }
                    pop_bit(attacks, att);
                }
                pop_bit(piece_board, source);
            }
        }
        // Knight moves
        else if (i == 2) {
            while(bool_bitboard(piece_board)) {
                let source = lsb_index(piece_board);
                let attacks = nand_bitboards(KNIGHT_ATTACK[source], BOARD[12 + TURN]);
                while (bool_bitboard(attacks)) {
                    let att = lsb_index(attacks);
                    if (get_bit(BOARD[12 + TURN ^ 1], att)) {
                        moves.push(create_move(source, att, piece, 0, 1));
                    } else {
                        moves.push(create_move(source, att, piece));
                    }
                    pop_bit(attacks, att);
                }
                pop_bit(piece_board, source);
            }
        }
        // Bishop moves
        else if (i == 3) {
            while(bool_bitboard(piece_board)) {
                let source = lsb_index(piece_board);
                let attacks = nand_bitboards(bishop_attack_fly(source, BOARD[14]), BOARD[12 + TURN]);
                while (bool_bitboard(attacks)) {
                    let att = lsb_index(attacks);
                    if (get_bit(BOARD[12 + TURN ^ 1], att)) {
                        moves.push(create_move(source, att, piece, 0, 1));
                    } else {
                        moves.push(create_move(source, att, piece));
                    }
                    pop_bit(attacks, att);
                }
                pop_bit(piece_board, source);
            }
        }
        // Queen moves
        else if (i == 4) {
            while(bool_bitboard(piece_board)) {
                let source = lsb_index(piece_board);
                let attacks = nand_bitboards(queen_attack_fly(source, BOARD[14]), BOARD[12 + TURN]);
                while (bool_bitboard(attacks)) {
                    let att = lsb_index(attacks);
                    if (get_bit(BOARD[12 + TURN ^ 1], att)) {
                        moves.push(create_move(source, att, piece, 0, 1));
                    } else {
                        moves.push(create_move(source, att, piece));
                    }
                    pop_bit(attacks, att);
                }
                pop_bit(piece_board, source);
            }
        }
        // King moves
        else if (i == 5) {
            // Normal moves
            let source = lsb_index(piece_board);
            let attacks = nand_bitboards(KING_ATTACK[source], BOARD[12 + TURN]);
            while (bool_bitboard(attacks)) {
                let att = lsb_index(attacks);
                if (get_bit(BOARD[12 + TURN ^ 1], att)) {
                    moves.push(create_move(source, att, piece, 0, 1));
                } else {
                    moves.push(create_move(source, att, piece));
                }
                pop_bit(attacks, att);
            }

            
            // Castling
            if (CASTLE) {
                let king_pos = [60, 4][TURN];
                let king_side = [[61, 62], [5, 6]][TURN];
                let queen_side = [[59, 58, 57], [3, 2, 1]][TURN];
                if (!PLAYER_WHITE) {
                    king_pos--;
                    king_side[0] -= 3;
                    king_side[1] -= 5;
                    queen_side[0] += 1;
                    queen_side[1] += 3;
                    queen_side[2] += 5;
                }

                if ((!TURN && get_castle_pk(CASTLE)) || (TURN && get_castle_ak(CASTLE))) {
                    if (!get_bit(BOARD[14], king_side[0]) && !get_bit(BOARD[14], king_side[1])) {
                        if (!is_square_attacked(king_pos, TURN ^ 1) && !is_square_attacked(king_side[0], TURN ^ 1)) {
                            moves.push(create_move(king_pos, king_side[1], piece, 0, 0, 0, 0, 1));
                        }
                    }
                }
                if ((!TURN && get_castle_pq(CASTLE)) || (TURN && get_castle_aq(CASTLE))) {
                    if (!get_bit(BOARD[14], queen_side[0]) && !get_bit(BOARD[14], queen_side[1]) && !get_bit(BOARD[14], queen_side[2])) {
                        if (!is_square_attacked(king_pos, TURN ^ 1) && !is_square_attacked(queen_side[0], TURN ^ 1)) {
                            moves.push(create_move(king_pos, queen_side[1], piece, 0, 0, 0, 0, 1));
                        }
                    }
                }
            }
        }
    }
    return moves;
}

function generate_capture_moves() {
    let moves = generate_pseudo_moves();
    let res = [];
    for (let i = 0; i < moves.length; i++) {
        if (get_move_capture(moves[i])) {
            res.push(moves[i]);
        } 
    }
    return res;
}

function finish() {
    let message = "Stalemate";
    if (is_square_attacked(lsb_index(BOARD[6 * TURN + 5]), TURN ^ 1)) {
        if (PLAYER_WHITE) {
            message = "Checkmate. " + (TURN ? "White" : "Black") + " wins";
        } else {
            message = "Checkmate. " + (TURN ? "Black" : "White") + " wins";
        }
    }
    setTimeout(() => { alert(message); }, 250);
    TURN = 2; // prevent moving pieces
}

// HTML FEATURES ----------------------------------------------------------------------------------------------------------------------

function undo_move() {
    GAME.pop();
    GAME.pop();
    MOVE_NUMBER--;
    if (!PLAYER_WHITE) { MOVE_NUMBER--; }
    BOARD = GAME[GAME.length - 1];
    GAME.pop(); // pushed back on in display_board

    GAME_MOVES.pop();
    GAME_MOVES.pop();

    display_board();
}

function play_fen(whiteDown) {
    FEN = document.getElementById("fen").value;
    if (FEN.length < 10) { FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"; }
    main(whiteDown);
}

function get_game_moves() {
    let temp = "";
    for (let i = 0; i < GAME_MOVES.length; i++) {
        if (i % 2 == 0) {
            temp += String(Math.floor(i / 2) + 1) + "." + " ";
        } 
        temp += GAME_MOVES[i] + " ";
    }
    return temp;
}

function get_pgn() {
    let start = '[Event "?"]\n[Site "?"]\n[Date "????.??.??"]\n[Round "?"]\n[White "?"]\n[Black "?"]\n[Result "*"]\n\n';

    let dummy = document.createElement("textarea");
    document.body.appendChild(dummy);
    dummy.value = start + get_game_moves() + "*";
    dummy.select();
    document.execCommand("copy");
    document.body.removeChild(dummy);
}

function get_fen() {
    let values; let castle; let en_pass;
    let start; let direction;
    if (PLAYER_WHITE) {
        values = "PRNBQKprnbqk";
        castle = (get_castle_pk(CASTLE) ? "K" : "") + (get_castle_pq(CASTLE) ? "Q" : "") + (get_castle_ak(CASTLE) ? "k" : "") + (get_castle_aq(CASTLE) ? "q" : "");
        if (EN_PASSANT_SQUARE) {
            en_pass = String.fromCharCode(97 + EN_PASSANT_SQUARE % 8) + (((64 - EN_PASSANT_SQUARE) / 8 >> 0) + 1);
        } else {
            en_pass = "-";
        }
        start = 0; direction = 1;
    } else {
        values = "prnbqkPRNBQK";
        castle = (get_castle_pk(CASTLE) ? "k" : "") + (get_castle_pq(CASTLE) ? "q" : "") + (get_castle_ak(CASTLE) ? "K" : "") + (get_castle_aq(CASTLE) ? "Q" : "");
        if (EN_PASSANT_SQUARE) {
            en_pass = String.fromCharCode(97 + 7 - EN_PASSANT_SQUARE % 8) + ((EN_PASSANT_SQUARE / 8 >> 0) + 1);
        } else {
            en_pass = "-";
        }
        start = 7; direction = -1;
    }
    if (!castle.length) { castle = "-"; }
    let res = ""; let count = 0;
    let i = start;
    while (0 <= i && i <= 7) {
        let j = start;
        while (0 <= j && j <= 7) {
            let p = 8 * i + j;
            if (get_bit(BOARD[14], p)) {
                if (count) {
                    res += (count);
                }
                count = 0;
                for (let k = 0; k < 12; k++) {
                    if (get_bit(BOARD[k], p)) {
                        res += values[k];
                    }
                }
            } else {
                count++;
            }
            j += direction;
        }
        if (count) {
            res += (count);
        }
        count = 0;
        res += "/";

        i += direction;
    }

    res = res.slice(0, res.length - 1) + " " + (PLAYER_WHITE ? "w" : "b") + " " + castle + " " + en_pass + " 0 1";

    let dummy = document.createElement("textarea");
    document.body.appendChild(dummy);
    dummy.value = res;
    dummy.select();
    document.execCommand("copy");
    document.body.removeChild(dummy);

    return res;
}

function play_rand_endgame(number) {
    ENGAMES = [
        ["6k1/5p2/6p1/8/7p/8/6PP/6K1 b - - 0 0", "Black"], // 3p vs 2p
        ["3k4/2n2B2/1KP5/2B2p2/5b1p/7P/8/8 b - - 0 0", "White"], // 2B vs BN
        ["4R3/1k6/1p2P1p1/p7/4r3/1P1r4/1K6/2R5 w - - 0 0", "Equal"], // 2R vs 2R
        ["8/8/7k/8/8/8/5q2/3B2RK b - - 0 1", "Black"], // Q vs RB
        ["8/6k1/8/R7/7K/1P6/5r2/8 b - - 0 1", "Equal"], // R1P vs R                     #5
        ["8/7p/6p1/5k2/7N/8/4KP2/8 b - - 0 0", "Equal"], // N1P vs 2P                   
        ["6k1/3R4/5Kp1/6r1/4P3/8/8/8 b - - 0 0", "Equal"], // R1P vs R1P
        ["8/1k6/8/5NP1/8/2p3K1/8/r7 w - - 0 51", "Black"], // N1P vs R1P
        ["8/1r4k1/3R1ppp/1p6/2p4P/2P5/1P4PK/8 b - - 0 43", "Equal"], // R5P vs R4P
        ["1r6/8/p4kp1/P1KP3p/8/7P/4B1P1/8 b - - 0 43", "Equal"], // B4P v R3P           #10
        ["8/8/2R2pk1/3r3p/1P3P1K/8/7P/8 w - - 0 47", "Equal"], // R3P v R2P
        ["8/5pkp/1n4p1/1P6/3K2P1/2N4P/8/8 w - - 0 70", "White"], // N vs. N
        ["8/8/7B/8/8/3p4/6Kp/3k1n2 w - - 0 0", "Equal"], // B vs. N
        ["2r1r3/5k2/3p3p/pp6/4P1PP/3P3Q/1P6/7K w - - 0 34", "White"], // Q v RR
        ["8/pp2k3/2p3B1/3p2P1/3n2K1/8/PPP5/8 b - - 0 0", "White"], // B vs. N           #15
        ["3k4/2p2p2/1p5p/p1p1P1p1/P1Pn2P1/1P3P1P/1B3K2/8 w - - 0 30", "Equal"], // B vs. N
        ["6b1/6p1/8/5kPP/K7/P1P5/8/8 w - - 0 50", "Equal"], // B vs. 3p
        ["6k1/1p3pp1/p2np2p/P7/2P2P2/1P5P/4N1P1/6K1 w - - 0 36", "White"], // N vs. N
        ["1n6/4k2p/p3ppp1/1pPp4/3P1PP1/3NP3/P3K2P/8 w - - 0 27", "White"], // N+pawns vs. N+pawns
        ["8/8/8/pp1k1p2/7p/1PK1PP1P/8/8 w - - 0 52", "Equal"], // 4p vs. 4p             #20
        ["R7/8/8/8/6K1/5p2/5Pk1/4r3 w - - 0 1", "Equal"], // R+p vs. R+p
        ["8/8/8/p1k2K1R/5P1P/8/4p1n1/8 w - - 0 1", "Equal"], // R vs. N (2p)
        ["8/pp4pp/2pn1k2/3p1p2/3P1K2/6PP/PPP1B1P1/8 w - - 0 24", "Equal"], // B vs. N
        ["4n3/p3k3/1p4P1/2pK4/P2p4/1P6/2P1B3/8 w - - 0 49", "White"], // B vs. N
        ["8/5k2/4p2p/4P3/B1np1KP1/3b4/8/2B5 b - - 0 1", "Equal"], // B+N vs. 2B         #25
        ["8/1p4p1/5p1p/1k3P2/6PP/3KP3/8/8 w - - 0 50", "White"] // K+P
        ["8/8/1p1k4/5ppp/PPK1p3/6P1/5PP1/8 b - - 0 0", "Black"] // K+P
    ]
    let index = number - 1;
    if (!index || index >= ENGAMES.length) {
        index = Math.floor(Math.random() * ENGAMES.length);
    } 
    console.log("ENDGAME INDEX: " + (index));
    FEN = ENGAMES[index][0];
    document.getElementById("endgame_winning").value = (index + 1) + ": " + (ENGAMES[index][1]);

    // document.getElementById("endgame_winning").innerHTML = '<h4 style="text-align: center;">' + ENGAMES[index][1] + '</h4>';

    i = 0;
    while (i < FEN.length) {
        if (FEN[i] == " ") {
            PLAYER_WHITE = FEN[i + 1] == "w";
            break;
        }
        i++;
    }
    main(PLAYER_WHITE);
}

function load_endgame() {
    play_rand_endgame(parseInt(document.getElementById("endgame_number").value))
}

function play_book_endgame() {
    ENGAMES = [
        "6k1/8/8/8/8/8/8/4BNK1 w - - 0 0", // BN vs K
    ]
    let index = Math.floor(Math.random() * ENGAMES.length);
    console.log("ENDGAME INDEX: " + (index));
    FEN = ENGAMES[index];
    i = 0;
    while (i < FEN.length) {
        if (FEN[i] == " ") {
            PLAYER_WHITE = FEN[i + 1] == "w";
            break;
        }
        i++;
    }
    main(PLAYER_WHITE);
}

function showLines() {
    let res = "";
    if (document.getElementById("lineCheckbox").checked) {
        for (let i = 1; i < pv_length[0]; i++) {
            res += get_move_desc(pv_table[0][i]) + " ";
            if (res.length > 30) { break; }
        }
    }
    document.getElementById("lines").value = res;
}

function override_depth() {
    LOOKAHEAD = document.getElementById("depth_override").value;
    DISABLE_LOOKAHEAD = true;
    alert("Depth updated");
}

function main(whiteDown) {
    DISABLE_LOOKAHEAD = false;
    PLAYER_WHITE = whiteDown;

    MOVE_NUMBER = 1; GAME = [];
    if (FEN == "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") {
        MOVE_NUMBER = 1;
        GAME_MOVES = [];
    } else if (FEN == "6k1/8/8/8/8/8/8/4BNK1 w - - 0 0") {
        GAME_MOVES = ["e4","e5","Qh5","Qh4","Qxh7","Qxh2","Qxh8","Qxh1","Qxg8","Qxg1","Qxg7","Qxg2","Qxf7+","Kd8","Qd5","Qxf2+","Kd1","Ke8","Qxb7","Kf7","Bg2","Qxg2","Qxa8","Kg8","Qxb8","Qxe4","Qxc8","Qxc2+","Ke1","Qxd2+","Kf1","Qxb2","Kg1","Qxa1","Qxc7","Qxa2","Qxe5","Bd6","Qxd6","Qf7","Qxd7","Qh7","Qxa7","Qf7","Qxf7+","Kxf7","Bd2","Kg8","Be1","Kf7","Nd2","Kf8","Nf1","Kg8"];

        MOVE_NUMBER = 28;
    } else {
        MOVE_NUMBER = Math.max(10, parseInt(FEN[FEN.length - 1]));
        GAME_MOVES = [];
    }
    make_table();

    console.log(FEN);
    BOARD = make_board(FEN);
    hash_key = init_hash();

    let gamephase_score = get_gamephase_score();
    if (gamephase_score > opening_phase) { GAMEPHASE = 0; }
    else if (gamephase_score < endgame_phase) { GAMEPHASE = 2; }
    else { GAMEPHASE = 1; }

    LOOKAHEAD = start_look;

    display_board();
}

// CONSTANTS  ----------------------------------------------------------------------------------------------------------------------

let PAWN_ATTACK;
let KNIGHT_ATTACK;
let KING_ATTACK;

let BOARD;

let PLAYER_WHITE;
let TURN; // 0 for player, 1 for ai
let CASTLE = create_castle();
let EN_PASSANT_SQUARE; // pawn moves 2 spots, record position behind pawn

let LOOKAHEAD_COUNT = 0;
let LOOKAHEAD;
let start_look = 5;

let GAMEPHASE = 0;
let opening_phase = 6192;
let endgame_phase = 518;

let GAME = [];
let GAME_MOVES = [];
let MOVE_NUMBER = 1;

initialiseConstants();
initialise_ai_constants();

let FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"; // start

main(true);