
const SpotifyWebApi = require('spotify-web-api-node');
const express       = require('express');
const fs            = require('fs');

// Don't need all of this access to lookup and add to playlists.
const scopes = [
   'ugc-image-upload',
   'user-read-playback-state',
   'user-modify-playback-state',
   'user-read-currently-playing',
   'streaming',
   'app-remote-control',
   'user-read-email',
   'user-read-private',
   'playlist-read-collaborative',
   'playlist-modify-public',
   'playlist-read-private',
   'playlist-modify-private',
   'user-library-modify',
   'user-library-read',
   'user-top-read',
   'user-read-playback-position',
   'user-read-recently-played',
   'user-follow-read',
   'user-follow-modify'
];

const fileImportName = process.argv.slice(2)[2]
const playListId     = process.argv.slice(2)[3]

const spotifyApi = new SpotifyWebApi({
   redirectUri: 'http://localhost:8080/callback',
   clientId:     process.argv.slice(2)[0],
   clientSecret: process.argv.slice(2)[1]
});

const app = express();


/**
 * # loadSongFile
 * Load the text file with song names in it. Uses fileImportName to find the file in the same directory.
 *
 * @returns {promise}
 */
async function loadSongFile(){
    return new Promise((resolve, reject)=>{
        fs.readFile( __dirname + "/" + fileImportName, function (err, data) {
            if (err){ reject(err) }
            resolve(data.toString());
        });
    })
};
/**
 * # forceWait
 * Returns a promise that will be resolved in after requested time.
 *
 * @param {number} length - Length to wait in ms.
 *
 * @returns {promise}
 */
async function forceWait(length){
    return new Promise((resolve) =>{
        setTimeout(resolve, length);
    })
};
/**
 * # lookupSong
 * Do the search to try to find the song id by title
 * 
 * @param {string} name - The search term "song name - artist".
 * 
 * @returns {promise}
 */
async function lookupSong(name){
    return new Promise((resolve, reject) => {
        spotifyApi.searchTracks(name)
        .then(function(data) {

            // Go through the first page of results
            var firstPage = data.body.tracks.items;

            if(firstPage.length < 1){
                reject("No songs found");
            }

            // Return the first song we find.
            resolve(firstPage[0].uri);
        }).catch(function(err) {
            console.log('Something went wrong:', err.message);
            reject(err)
        });
    })
};
/**
 * # addSongsToPlaylist
 * Add the songs to Spotify playlist. Note: There is a limit to how many you can add at a time (I tried 2500 and it failed).
 *
 * @param {string} playListId - Id to the playlist.
 * @param {array}  list       - Array of spotify track ids.
 *
 * @returns {promise}
 */
async function addSongsToPlaylist(playListId, list){
    return new Promise((resolve, reject)=>{
        spotifyApi.addTracksToPlaylist(
            playListId,
            list,
            { position: 0 }
        ).then(function(data) {
            console.log('Added tracks to the playlist!');
            resolve()
        })
        .catch(function(err) {
            console.log('Something went wrong:', err.message);
            reject(err)
        });
    })
};
/**
 * # processRecords
 * Load and process the file
 * 
 * @returns null
 */
async function processRecords(){
    console.log(`[Status]: Processing file '${fileImportName}'.`)

    // Load the file of song names (format is song - artist but not always formatted correctly).
    let file = await loadSongFile();

    // Remove any \r and make them \n.
    file = file.split('\r').join("\n").split('\n\n').join('\n');

    // Remove any lines that are empty.
    let fileSplit = file.split("\n");
    let filtered  = [];

    for(let i = 0; i < fileSplit.length; i += 1){

        let line = fileSplit[i];

        // Verify that it's not empty line (with spaces sometimes).
        line = line.split(' ').join("").replace(/\t/g);

        if(line === ""){
            continue
        }

        // It's not empty so add it to our list.
        filtered.push(fileSplit[i])
    }

    let unableToFind = "";
    let retry = false;

    // Lookup the track id for every song.
    for(let i = 0; i < filtered.length; i += 1){

        console.log(`[${i}/${filtered.length}]:Looking up '${filtered[i]}'.`)

        try{
            // Look up the first song we find by name.
            let id = await lookupSong(filtered[i]);

             // Add the song to the play list.
            await addSongsToPlaylist(playListId, [id])
        }catch(e){

            // Do the search again if it failed just to verify it wasn't rate limit.
            if(retry){
                // If we had trouble finding it, go to the next one.
                console.log("[Error]: lookupSong", e)
                unableToFind += filtered[i] + "\n";
            }else{
                console.log("[Error]: lookupSong - Retrying once.");
                i -= 1;
                await forceWait(5000);
            }

            retry = !retry;
        }

        // Limit it to twice a second so we don't hit rate limit.
        await forceWait(500);
    }

    console.log("[Status]: Writing 'unable_to_find.txt' out.")

    // Write out the ones we could find.
    fs.writeFile('unable_to_find.txt', unableToFind, function (err) {
        if (err) return console.log(err);

        console.log("[Status]: Done processing!")
     });
};

app.get('/login', (req, res) => {
   res.redirect(spotifyApi.createAuthorizeURL(scopes));
});

app.get('/callback', (req, res) => {
   const error = req.query.error;
   const code = req.query.code;

   if (error) {
     console.error('Callback Error:', error);
     res.send(`Callback Error: ${error}`);
     return;
   }

   spotifyApi
     .authorizationCodeGrant(code)
     .then(data => {
       const access_token  = data.body['access_token'];
       const refresh_token = data.body['refresh_token'];
       const expires_in    = data.body['expires_in'];

       spotifyApi.setAccessToken(access_token);
       spotifyApi.setRefreshToken(refresh_token);

       // console.log('access_token:', access_token);
       // console.log('refresh_token:', refresh_token);

       console.log(`Sucessfully retreived access token. Expires in ${expires_in} s.`);
       res.send('Success! You can now close the window.');

       setInterval(async () => {
         const data = await spotifyApi.refreshAccessToken();
         const access_token = data.body['access_token'];

         console.log('The access token has been refreshed!');
         // console.log('access_token:', access_token);
         spotifyApi.setAccessToken(access_token);
       }, expires_in / 2 * 1000);

       // Start up the processor.
       setTimeout(processRecords, 1);
     })
     .catch(error => {
       console.error('Error getting Tokens:', error);
       res.send(`Error getting Tokens: ${error}`);
     });
});

app.listen(8080, () =>
    console.log('HTTP Server up. Now go to http://localhost:8080/login in your browser.')
);