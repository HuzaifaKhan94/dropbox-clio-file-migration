import { useState, useEffect } from 'preact/hooks';

export const MattersList = ({matters=[], selectedMatter, setSelectedMatter}) => {

    return (
        <section>
            <h3 className='text-lg font-semibold mb-2'>Matters</h3>
            <ul className='p-4 border-1 border-[#797979] rounded-md'>
                {matters.length > 0 && matters.map((matter, indx) => (
                    <li
                    onClick={() => setSelectedMatter(matter)}
                    className={`rounded-md cursor-pointer hover:bg-purple-500/25 ${
                      selectedMatter?.id === matter.id ? 'bg-purple-300/30 font-bold' : ''
                    }`}
                    key={indx}>
                        <div className='p-2'>
                            <p>{matter.display_number}</p>
                            <p className='text-xs'>{matter.description}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
};
