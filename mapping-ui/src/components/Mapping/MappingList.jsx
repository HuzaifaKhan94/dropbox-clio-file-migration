import { useState, useEffect } from 'preact/hooks';
import { Dropdown } from '../Dropdown/Dropdown';

export const MappingList = ({ mappings = [], folders = [], onFolderChange }) => {

  return (
    <div className="rounded-lg border border-gray-300">
      <table className='w-full text-left'>
        <thead className='border-b-1'>
          <tr>
            <th className='p-2'>Clio Matter</th>
            <th className='p-2'>Dropbox Folder</th>
          </tr>
        </thead>
        <tbody>
          {mappings.length > 0 && mappings.map((mapping) => (
            <tr
              key={mapping.matterId}
              className={
                mapping.matchStatus === 'green'
                  ? 'bg-green-900'
                  : mapping.matchStatus === 'amber'
                  ? 'bg-yellow-900'
                  : 'bg-red-900'
              }>
                <td className='p-2'>{mapping.display_number}</td>
                <td className='p-2'>
                  <Dropdown
                    selected={mapping.folderPath}
                    options={folders}
                    onSelect={(newFolderPath) => onFolderChange(mapping.matterId, newFolderPath)}
                  />
                </td>
              </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};


// import { useState, useEffect } from 'preact/hooks';

// export const MappingList = ({ mapping = {}, matters = [], folders = [] }) => {
//   const getMatterById = (id) => matters.find(m => m.id === id);
//   const getFolderByPath = (path) => folders.find(f => f.path === path);

//   const entries = Object.entries(mapping);

//   return (
//     <section>
//       <h3 className="text-lg font-semibold mb-2">Current Mappings</h3>
//       {entries.length === 0 ? (
//         <p className="text-gray-500">No mappings yet.</p>
//       ) : (
//         <ul className="space-y-2 border-1 border-[#797979] rounded-md p-4">
//           {entries.map(([matterId, folderPath]) => {
//             const matter = getMatterById(Number(matterId));
//             const folder = getFolderByPath(folderPath);

//             return (
//               <li key={matterId} className="text-sm">
//                 <strong>{matter?.display_number || `Matter ${matterId}`}</strong> ↔︎ 
//                 <span className="ml-1 text-purple-300/75">{folder?.name || folderPath}</span>
//               </li>
//             );
//           })}
//         </ul>
//       )}
//     </section>
//   );
// };
