import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import DiscussionThreadView from './DiscussionThreadView';
import { MaterializedDiscussionThread } from '../../lib/crdt/Discussions';
const padding = 20;
function calculatePositions(tops: {[thread: string]: number}, heights: {[thread: string]: number}, selectedId: string | null) {
    
    const locations: {[thread: string]: number} = {};

    type Loc = [string, { top: number; height: number }];
    let findMe: Loc | undefined;
    const sorted = Object.entries(tops)
        .map(([id, top]) => {
        
        const loc: Loc = [id, { top: top, height: heights[id] }];
        if (id === selectedId) {
            findMe = loc;
        }
        return loc;
        })
        .sort((a, b) => {
        return a[1].top - b[1].top;
        });

    const idx = findMe ? sorted.indexOf(findMe) : 0;
    // Push upwards from target (or nothing)
    const before = sorted.slice(0, idx + 1).reduceRight((prev, [id, loc]) => {
        const { top } = prev[prev.length - 1]?.[1] ?? {};
        const newTop = Math.min(top - loc.height - padding, loc.top) || loc.top;
        const next = [id, { top: newTop, height: loc.height }] as Loc;
        return [...prev, next];
    }, [] as Loc[]);

    // Push comments downward
    const after = sorted.slice(idx).reduce((prev, [id, loc]) => {
        const { top, height } = prev[prev.length - 1]?.[1] ?? {};
        const newTop = Math.max(top + height + padding, loc.top) || loc.top;
        const next = [id, { top: newTop, height: loc.height }] as Loc;
        return [...prev, next];
    }, [] as Loc[]);

    const idealPlacement = Object.fromEntries([...before, ...after]);

    const placements = {} as {[thread: string]: number}
    for (const [k, v] of Object.entries(idealPlacement)) {
        placements[k] = v.top
    }
    
    return placements;
    
}

interface Props {
    discussions: MaterializedDiscussionThread[];
    userMap: { [userId: string]: { avatar_url: string, login: string }};
    selected: string | null,
    disussionTops: {[discussionId: string]: number}
    onActivate: (discussionId: string) => void;
    onResolve: (discussionId: string) => void;
    onDelete: (discussionId: string) => void;
    onComment: (discussionId: string, commentText: string) => void;
    onReaction: (discussionId: string, reaction: string, untoggle: boolean) => void;
}

const DiscussionList = ({
    discussions, 
    userMap,
    selected, 
    disussionTops,
    onActivate,
    onResolve,
    onDelete,
    onComment,
    onReaction} : Props) => {


    const [heightsByThreadId, setHeightsByThreadId] = useState<{[threadId: string]: number}>({})
    const [calculatedTopsByThreadId, setCalculatedTopsByThreadId] = useState<{[thread: string]: number}>({});


    const discussionThreadContainer = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (Object.keys(disussionTops).length > 0 && Object.keys(heightsByThreadId).length > 0) {
            setCalculatedTopsByThreadId(calculatePositions(disussionTops, heightsByThreadId, selected));
        }
        
    }, [heightsByThreadId, disussionTops, selected])
    
    // const [discussionThreadsMeassures, setdiscussionThreadsMeassures] = useState<Measurements[]>([]);

    // needs to know what comments are relevant 
    // - (annotations have a position)
    // order is based on the offset, date
    // which comment is currently highlighted
    // 

    useLayoutEffect(() => {
        
        const container = discussionThreadContainer.current;
        if (!container) return;
        let index = 0;
        let heights: {[threadId: string]: number} = {};
        for (const div of container.children) {
            console.log(div.getBoundingClientRect());
            heights[discussions[index].entityId] = div.getBoundingClientRect().height
            index += 1;
        }
        setHeightsByThreadId(heights);
      }, [discussions]);

console.log('const [discussionThreadsMeassures, setdiscussionThreadsMeassures] = useState<Measurements[]>([]);const [discussionThreadsMeassures, setdiscussionThreadsMeassures] = useState<Measurements[]>([]);const [discussionThreadsMeassures, setdiscussionThreadsMeassures] = useState<Measurements[]>([]);')
      console.log(disussionTops)

    const comments = [
        {
            id: 'comment1',
            discussionId: 'discussion1',
            type: 'c' as 'c',
            createdAt: Date.now() - 10000,
            authorId: 'JaneDoe',
            comment: 'This is a comment.',
        },
    ];
    return (
        <div ref={discussionThreadContainer}
            style={{ position: 'relative' }}
            
            >
            { discussions.filter((discussion => !discussion.deletedAt && !discussion.resolved)).map((discussion, index) => (
                
                <div
                    key={discussion.entityId}
                    className='discussion-thread-wrapper'
                    style={{top: calculatedTopsByThreadId[discussion.entityId] ?? 0, position: 'absolute' }}
                >
                <DiscussionThreadView
                    userMap={userMap}
                    discussion={discussion}
                    selected={discussion.entityId === selected}
                    onResolve={onResolve}
                    onDelete={onDelete}
                    onComment={onComment}
                    onReaction={onReaction} 
                    onActivate={onActivate}/>
                </div>
                
            ))}
        </div>
    );
};

export default DiscussionList;