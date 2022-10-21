const lichessToken = "lip_MA32fhNSSvV6zJnMmfAJ"

const get_acc = () => {
    fetch("https://lichess.org/api/account/")
        .then(response => response.json())
        .then(data => console.log(data))
}

const import_pgn = () => {
    fetch("https://lichess.org/api/import/", {
        method: "POST",
        body: 0,
        headers: { "Authorization": `Bearer ${lichessToken}` }
    })
        .then(response => response.json())
        .then(data => console.log(data))
}