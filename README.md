# spotify-music-importer
Imports music by searching for song names on Spotify based on lines in text file.

# Understanding use case
As a favor I made this script to port a text document to Spotify that my friend has been writing song titles in for five years. It is not very full featured because it's a single use script so please keep that in mind. The text file was writen by hand so it had many mistakes so it was important to write out anything that didn't match in Spotify to a new document to be done by hand.

# Installing
There is no configuration required, just install the libraries and use it.

```console
npm install
```

You will also need to setup a Spotify developer application which can be done here https://developer.spotify.com/

# Usage

```console

# Structure
node index.js <spotifyClientId> <spotifySecret> <filename> <playlistId>

# Example
node index.js xxxxxxx yyyyyyyy Song_Names.txt 5FmmxErJczcrEwIFGIviYo
```

# Example text file
The script will remove any empty lines and process each line as a different song. If it cannot find the song on spotify it will add it to a list and at the end write it out to a text file. 

```
Miike Snow - In Search Of

Miike Snow - Faker
Till I collapse - Eminem
Miike Snow - Burial

Miike Snow - The Rabbit
Miike Snow - Sans Soleil
```
