import { useState, useEffect } from 'preact/hooks';

export const FolderList = ({folders=[], selectedFolder, setSelectedFolder}) => {

    return (
        <section>
            <h3 className='text-lg font-semibold mb-2'>Dropbox Folders</h3>
            <ul className='p-4 border-1 border-[#797979] rounded-md space-y-4'>
                {folders.length > 0 && folders.map((folder, indx) => (
                    <li
                    onClick={() => setSelectedFolder(folder)}
                    className={`cursor-pointer hover:bg-purple-500/25 ${
                        selectedFolder?.path === folder.path ? 'bg-purple-300/30 font-bold' : ''
                      }`}
                    key={indx}>
                        {folder.name}
                    </li>
                ))}
            </ul>
        </section>
    );
};
