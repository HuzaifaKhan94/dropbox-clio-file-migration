import { useEffect,useState } from 'preact/hooks';
import { FolderList } from '../Folders/FolderList';
import { MattersList } from '../Matters/MattersList';
import axios from 'axios';
import { MappingList } from './MappingList';

export const Mapping = () => {
    const [folders, setFolders] = useState([]);
    const [matters, setMatters] = useState([]);
    const [mapping, setMapping] = useState({});

    const [selectedFolder, setSelectedFolder] = useState(null);
    const [selectedMatter, setSelectedMatter] = useState(null);

    useEffect(() => {
        async function load() {
          const [fRes, mRes] = await Promise.all([
            axios.get('/api/dropbox/folders'),
            axios.get('/api/clio/matters'),
          ]);
      
          const folders = fRes.data.folders || [];
          const rawMatters = mRes.data.matters || [];
      
          const { newMapping, annotatedMatters } = autoMatchFoldersToMatters(rawMatters, folders);
      
          setFolders(folders);
          setMatters(annotatedMatters);
          setMapping(newMapping);
        }
      
        load();
    }, []);

    useEffect(() => {
        if (selectedFolder && selectedMatter) {
            setMapping(prev => ({
                ...prev,
                [selectedFolder.path]: selectedMatter
            }));
            setSelectedFolder(null);
            setSelectedMatter(null);
        }
    },[selectedFolder, selectedMatter]);

    const autoMatchFoldersToMatters = (matters, folders) => {
        const newMapping = {};
        const annotatedMatters  = [];

        for (const matter of matters) {
            const matches = folders.filter(folder => folder.name.toLowerCase().includes(matter.number));

            let matchType = 'red';
            let selectedFolder = null;

            if (matches.length > 0) {
                selectedFolder = matches[0];
                newMapping[matter.id] = selectedFolder.path;

                if (matches.length === 1) matchType = 'green';
                if (matches.length > 1) matchType = 'amber';
            }

            annotatedMatters.push({
                ...matter,
                folderMatches: matches,
                matchType,
                selectedFolder
            });
        }

        return { newMapping, annotatedMatters };
    };

    const saveMapping = async () => {
        await axios.post('/api/mapping', { mapping });
        alert('Mapping saved!');
    };

    return (
        <section className='p-8'>
            <h2 className='text-2xl'>Dropbox Clio Mapping</h2>
            <div style="padding:1rem;">
                <button onClick={saveMapping}>Save Mapping</button>
            </div>
            <div className='flex gap-8'>
                <MattersList
                    matters={matters}
                    selectedMatter={selectedMatter}
                    setSelectedMatter={setSelectedMatter}
                />
                <FolderList
                    folders={folders}
                    selectedFolder={selectedFolder}
                    setSelectedFolder={setSelectedFolder}
                />
                <MappingList
                    mapping={mapping}
                    folders={folders}
                    matters={matters}
                />
            </div>

        </section>
    );
};