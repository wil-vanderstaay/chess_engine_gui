const lichessToken = "lip_MA32fhNSSvV6zJnMmfAJ"

const get_acc = () => {
    fetch("https://lichess.org/api/account", {
        method: "GET",
        headers: { "Authorization": `Bearer ${lichessToken}` }
    })
        .then(response => response.json())
        .then(data => console.log(data))
}

const import_pgn = (ogn) => {
    let data = new FormData();
    data.append('pgn', '1. e4 e6 2. d4 d5 3. Nd2 Nc6 4. exd5 Nxd4 5. dxe6 Nxe6 6. Ngf3 Nf6 7. Bb5 c6 8. Ba4 Nc5 *');
    fetch("https://lichess.org/api/import", {
        method: "POST",
        body: data,
        headers: { "Authorization": `Bearer ${lichessToken}` }
    })
        .then(response => response.json())
        .then(data => console.log(data))
}