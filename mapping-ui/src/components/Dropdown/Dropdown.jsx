import { useState } from "preact/hooks";

export const Dropdown = ({ selected, options, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = options.filter(folder =>
    folder.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (folder) => {
    onSelect(folder);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative">
      <div
        className="border rounded-md p-2 w-full cursor-pointer text-sm backdrop-blur bg-[#0000009c]"
        onClick={() => setIsOpen(prev => !prev)}
      >
        {selected ? selected : 'Select a folder...'}
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full bg-[#0000009c] backdrop-blur rounded-md border mt-1 shadow-lg">
          <input
            type="text"
            className="border-b p-2 w-full text-sm"
            placeholder="Search folders..."
            value={search}
            onInput={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-40 overflow-auto">
            {filteredOptions.map((folder) => (
              <div
                key={folder.path}
                className="p-2 text-sm hover:bg-gray-100 cursor-pointer"
                onClick={() => handleSelect(folder)}
              >
                {folder.name}
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div className="p-2 text-sm text-gray-500">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
