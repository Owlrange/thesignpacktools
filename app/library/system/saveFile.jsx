#target illustrator


// ==========================================
// Base64 → UTF-8
// ==========================================

function base64ToUtf8(base64){

    var chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    var binary = "";

    var buffer = 0;
    var bits = 0;


    for(var i = 0; i < base64.length; i++){

        var c =
            base64.charAt(i);

        if(c === "=")
            break;


        var value =
            chars.indexOf(c);


        if(value < 0)
            continue;


        buffer =
            (buffer << 6) | value;

        bits += 6;


        if(bits >= 8){

            bits -= 8;


            binary += String.fromCharCode(
                (buffer >> bits) & 0xFF
            );

        }

    }


    // ======================================
    // Converte UTF-8 binário para Unicode
    // ======================================

    var result = "";


    for(var i = 0; i < binary.length; i++){

        var c =
            binary.charCodeAt(i);


        // ASCII
        if(c < 128){

            result +=
                String.fromCharCode(c);

            continue;

        }


        // 2 bytes
        if(c >= 192 && c < 224){

            var c2 =
                binary.charCodeAt(++i);


            result +=
                String.fromCharCode(
                    ((c & 31) << 6) |
                    (c2 & 63)
                );

            continue;

        }


        // 3 bytes
        if(c >= 224 && c < 240){

            var c2 =
                binary.charCodeAt(++i);

            var c3 =
                binary.charCodeAt(++i);


            result +=
                String.fromCharCode(
                    ((c & 15) << 12) |
                    ((c2 & 63) << 6) |
                    (c3 & 63)
                );

            continue;

        }


        // 4 bytes
        if(c >= 240 && c < 248){

            var c2 =
                binary.charCodeAt(++i);

            var c3 =
                binary.charCodeAt(++i);

            var c4 =
                binary.charCodeAt(++i);


            var codePoint =
                ((c & 7) << 18) |
                ((c2 & 63) << 12) |
                ((c3 & 63) << 6) |
                (c4 & 63);


            codePoint -= 0x10000;


            result +=
                String.fromCharCode(
                    0xD800 +
                    (codePoint >> 10)
                );


            result +=
                String.fromCharCode(
                    0xDC00 +
                    (codePoint & 1023)
                );

        }

    }


    return result;

}



// ==========================================
// Salvar arquivo
// ==========================================

function saveFile(path, base64Content){

    try{

        var content =
            base64ToUtf8(
                base64Content
            );


        var file =
            new File(path);


        file.encoding =
            "UTF-8";


        if(!file.open("w")){

            return (
                "ERROR: Não foi possível abrir o arquivo:\n" +
                path
            );

        }


        file.write(
            content
        );


        file.close();


        return (
            "SUCCESS: " +
            file.fsName
        );

    }
    catch(e){

        return (
            "ERROR: " +
            e.message
        );

    }

}