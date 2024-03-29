/* eslint-disable jsx-a11y/alt-text */
import React, { useEffect, useRef, useState } from 'react';
import './DiscussionThreadView.css'; // Import CSS file for styling
import { MaterializedDiscussionThread } from '../../lib/crdt/Discussions';
import MenuButton from '../menubutton/MenuButtons';
import TimeAgo from 'javascript-time-ago'

// English.
import en from 'javascript-time-ago/locale/en'

TimeAgo.addDefaultLocale(en)

// Create formatter (English).
const timeAgo = new TimeAgo('en-US')

interface Props {
    discussion: MaterializedDiscussionThread;
    userMap: { [userId: string]: { avatar_url: string, login: string }};
    selected: boolean,
    onResolve: (discussionId: string) => void;
    onDelete: (discussionId: string) => void;
    onComment: (discussionId: string, commentText: string) => void;
    onReaction: (discussionId: string, reaction: string, untoggle: boolean) => void;
    onActivate: (discussionId: string) => void;
}

const DiscussionThreadView: React.FC<Props> = ({ discussion, userMap, selected, onResolve, onDelete, onComment, onReaction, onActivate }) => {

    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const [showEmoticonMenu, setShowEmoticonMenu] = useState(false);
    const [commentInput, setCommentInput] = useState('');

    const [commentInputActive, setCommentInputActive] = useState(false);

    const resizeTextArea = () => {
        if (!textAreaRef.current) {
          return;
        }
    
        textAreaRef.current.style.height = "auto"; // will not work without this!
        textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
      };

    

    useEffect(() => {
        const onFocus = () => {
            setCommentInputActive(true);
        }

        const textArea = textAreaRef.current
        textArea?.addEventListener("focus", onFocus);

        return () => {
            textArea?.removeEventListener("focus", onFocus);
        }
    }, []);

    useEffect(() => {
        resizeTextArea();
        window.addEventListener("resize", resizeTextArea);
      }, []);

    const handleResolve = () => {
        onResolve(discussion.entityId);
    };

    
    const handleEdit = (id: string) => {
        
    };

    const handleDelete = (id: string) => {
        onDelete(id);
    };

    const handleComment = () => {
        onComment(discussion.entityId, commentInput);
        setCommentInput('');
    };

    const handleReaction = (id: string, reaction: string, toggleOff: boolean) => {
        onReaction(id, reaction, toggleOff);
        setShowEmoticonMenu(false);
    };

    return (
        <div className={`discussion-thread ${ selected ? ' discussion-thread-selected' :''}`} onClick={() => {onActivate(discussion.entityId)}}>
            <div className="discussion-header">
                <div className="author-info">
                    <img src={userMap[discussion.createdBy] ? userMap[discussion.createdBy].avatar_url : 'loading'} />
                    <div>
                        <div className="author">{userMap[discussion.createdBy] ? userMap[discussion.createdBy].login : 'loading'}</div>
                        <div className="created-at">{discussion.createdAt ? timeAgo.format(new Date(discussion.createdAt)): ''}</div>
                    </div>
                </div>
                <div className="actions">
                    {discussion.note && (
                        <MenuButton>
                            <div onClick={() => { 
                                    handleEdit(discussion.entityId); 
                                }} >Edit</div>
                            {!discussion.deletedAt && (
                                <div onClick={() => { 
                                    handleDelete(discussion.entityId); 
                                }} >Delete</div>
                            )}
                        </MenuButton>
                   )}
                </div>
            </div>
            { discussion.createdAt && 
                <div className="comment-text" onMouseEnter={() => setShowEmoticonMenu(true)} onMouseLeave={() => setShowEmoticonMenu(false)}>
                    {discussion.note}
                    {showEmoticonMenu && (
                        <div className="emoticon-menu">
                            <span onClick={() => handleReaction(discussion.entityId, 'like', true)}>😀</span>
                            <span onClick={() => handleReaction(discussion.entityId, 'love', true)}>❤️</span>
                            <span onClick={() => handleReaction(discussion.entityId, 'angry', true)}>😡</span>
                        </div>
                    )}
                </div>
            }

            {discussion.replies.map((reply) => (
                <div key={reply.entityId} className="existing-comment">
                    <div className="author-info">
                        <img src={userMap[reply.createdBy] ? userMap[reply.createdBy].avatar_url : 'loading'} />
                        <div>
                            <div className="author">{userMap[reply.createdBy] ? userMap[reply.createdBy].login : 'loading'}</div>
                            <div className="created-at">{reply.createdAt ? timeAgo.format(new Date(reply.createdAt)): ''}</div>
                        </div>
                    </div>
                    <div className="comment-text">{reply.note}</div>
                </div>
            ))}

            <div className="comment-input">
                <textarea
                    className="textarea"
                    value={commentInput}
                    placeholder={ !discussion.note ? 'Comment' : 'Reply' }
                    ref={textAreaRef}
                    onChange={(e) => {
                        setCommentInput(e.target.value);
                        resizeTextArea();
                    }}
                    
                ></textarea>
                {/* <input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder={ !discussion.createdAt ? 'Comment' : 'Reply' } /> */}
                {/* <button onClick={handleCancel}>Cancel</button> */}
            </div>

            { commentInputActive && (    
            <div className='comment-button-bar' >
                <button className="button button-secondary float-right" onClick={() => {
                    if (!discussion.note) {
                        handleDelete(discussion.entityId);
                    } else {
                        setCommentInput('');
                    }
                    setCommentInputActive(false);
                    setTimeout(() => resizeTextArea(), 20);
                }}>
                    <span className="button button-content">
                        <span className="button-label">Cancel</span>
                    </span>
                </button>
                <div className='position-relative float-right'>
                    <button className="button button-primary" onClick={handleComment} disabled={commentInput.length === 0}>
                        <span className="button-content">
                            <span className="button-label">{ !discussion.note ? 'Comment' : 'Reply' }</span>
                        </span>
                    </button>
                 </div>
            </div>)}
            {  (
                <div className='comment-bottom'></div>
            )}
            {/* {!discussion.resolved && selected && (
            <div style={{padding: 16}}>
                <button className="button button-secondary" onClick={handleResolve} disabled={commentInput.length === 0}>
                    <span className="button-content">
                        <span className="button-label">Resolve Discussion</span>
                    </span>
                 </button>
            </div>
            )} */}
        </div>
    );
};

export default DiscussionThreadView;
