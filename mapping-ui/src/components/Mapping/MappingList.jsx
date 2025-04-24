import { useState, useEffect } from 'preact/hooks';

export const MappingList = ({ mapping = {}, matters = [], folders = [] }) => {
  const getMatterById = (id) => matters.find(m => m.id === id);
  const getFolderByPath = (path) => folders.find(f => f.path === path);

  const entries = Object.entries(mapping);

  return (
    <section className="mt-8">
      <h3 className="text-lg font-semibold mb-2">Current Mappings</h3>
      {entries.length === 0 ? (
        <p className="text-gray-500">No mappings yet.</p>
      ) : (
        <ul className="space-y-2 border-1 border-[#797979] rounded-md p-4">
          {entries.map(([matterId, folderPath]) => {
            const matter = getMatterById(Number(matterId));
            const folder = getFolderByPath(folderPath);

            return (
              <li key={matterId} className="text-sm">
                <strong>{matter?.display_number || `Matter ${matterId}`}</strong> ↔︎ 
                <span className="ml-1 text-purple-300/75">{folder?.name || folderPath}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
