function initializeLibraryCache(sourcePath){

    try{

        var cacheRoot =
            new Folder(
                Folder.userData +
                "/TheSignPackTools"
            );

        var cacheLibrary =
            new Folder(
                cacheRoot.fsName +
                "/library"
            );


        if(!cacheRoot.exists){

            if(!cacheRoot.create()){

                return (
                    "ERROR: Não foi possível criar a pasta TheSignPackTools."
                );

            }

        }


        // ==========================================
        // CACHE JÁ EXISTE
        // ==========================================

        if(cacheLibrary.exists){

            return (
                "SUCCESS:" +
                cacheLibrary.fsName
            );

        }


        // ==========================================
        // BIBLIOTECA-BASE
        // ==========================================

        var source =
            new Folder(
                sourcePath
            );


        if(!source.exists){

            return (
                "ERROR: Biblioteca base não encontrada:\n" +
                source.fsName
            );

        }


        // ==========================================
        // CRIA CACHE
        // ==========================================

        if(!cacheLibrary.create()){

            return (
                "ERROR: Não foi possível criar a biblioteca do cache."
            );

        }


        copyFolderContents(
            source,
            cacheLibrary
        );


        return (
            "SUCCESS:" +
            cacheLibrary.fsName
        );

    }
    catch(e){

        return (
            "ERROR:" +
            e.message
        );

    }

}


function copyFolderContents(
    sourceFolder,
    destinationFolder
){

    var items =
        sourceFolder.getFiles();


    for(
        var i = 0;
        i < items.length;
        i++
    ){

        var item =
            items[i];


        if(
            item instanceof Folder
        ){

            var newFolder =
                new Folder(
                    destinationFolder.fsName +
                    "/" +
                    item.name
                );


            if(
                !newFolder.exists
            ){

                if(!newFolder.create()){

                    throw new Error(
                        "Não foi possível criar: " +
                        newFolder.fsName
                    );

                }

            }


            copyFolderContents(
                item,
                newFolder
            );

        }
        else{

            var destination =
                new File(
                    destinationFolder.fsName +
                    "/" +
                    item.name
                );


            if(
                !item.copy(
                    destination.fsName
                )
            ){

                throw new Error(
                    "Não foi possível copiar: " +
                    item.name
                );

            }

        }

    }

}


function getCacheLibraryPath(){

    try{

        var cacheRoot =
            new Folder(
                Folder.userData +
                "/TheSignPackTools"
            );


        var cacheLibrary =
            new Folder(
                cacheRoot.fsName +
                "/library"
            );


        return cacheLibrary.fsName;

    }
    catch(e){

        return (
            "ERROR:" +
            e.message
        );

    }

}