import { useEffect,useState } from 'preact/hooks';
import { FolderList } from '../Folders/FolderList';
import { MattersList } from '../Matters/MattersList';
import axios from 'axios';
import { MappingList } from './MappingList';

export const Mapping = () => {
    const [folders, setFolders] = useState([]);
    const [matters, setMatters] = useState([]);
    const [mappings, setMappings] = useState({});

    useEffect(() => {
        async function load() {
          const [fRes, mRes] = await Promise.all([
            axios.get('/api/dropbox/folders'),
            axios.get('/api/clio/matters'),
          ]);
      
          const folders = fRes.data.folders || [];
          const rawMatters = mRes.data.matters || [];
      
          const annotatedMappings = autoMatchFoldersToMatters(rawMatters, folders);
      
          setFolders(folders);
          setMatters(rawMatters);
          setMappings(annotatedMappings);
        }
      
        load();
    }, []);

    const autoMatchFoldersToMatters = (matters, folders) => {
        const annotatedMappings = [];
      
        for (const matter of matters) {
          const matches = folders.filter(folder =>
            folder.name.toLowerCase().includes(matter.number)
          );
      
          let matchStatus = 'red';
          let selectedFolder = null;
      
          if (matches.length > 0) {
            selectedFolder = matches[0];
            if (matches.length === 1) {
              matchStatus = 'green';
            } else {
              matchStatus = 'amber';
            }
          }
      
          annotatedMappings.push({
            matterId: matter.id,
            display_number: matter.display_number,
            folderPath: selectedFolder?.path || null,
            matchStatus,
          });
        }
      
        return annotatedMappings;
    };
      

    const saveMapping = async () => {
        await axios.post('/api/mapping', { mapping: mappings });
        alert('Mapping saved!');
    };

    return (
        <section className='p-8'>
            <h2 className='text-2xl'>Dropbox Clio Mapping</h2>
            <div style="padding:1rem;">
                <button onClick={saveMapping}>Save Mapping</button>
            </div>

            <div className='flex gap-8'>
                {/* <MattersList
                    matters={matters}
                    selectedMatter={selectedMatter}
                    setSelectedMatter={handleMatterSelect}
                />
                <FolderList
                    folders={folders}
                    selectedFolder={selectedFolder}
                    setSelectedFolder={setSelectedFolder}
                /> */}
                <MappingList
                    mappings={mappings}
                    folders={folders}
                    matters={matters}
                />
            </div>

        </section>
    );
};