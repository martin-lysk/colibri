import React, { useState, useRef, useEffect } from 'react';

interface MenuButtonProps {
  children: React.ReactNode;
}

const MenuButton: React.FC<MenuButtonProps> = ({ children }) => {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Function to handle clicks outside the menu
    const handleClickOutside = (event: MouseEvent) => {
     
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    // Add event listener to detect clicks outside the menu
    document.addEventListener('mousedown', handleClickOutside);

    // Clean up the event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleMenuClick = () => {
    setMenuOpen(!isMenuOpen);
  };

  const handleItemClick = (item: string) => {
    // Handle click of menu item
    console.log(`Clicked ${item}`);
    // Additional logic here
    // For example, you could close the menu after item click
    setMenuOpen(false);
  };

  return (
    <div>
      <button ref={buttonRef} onClick={handleMenuClick}>
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-kebab-horizontal">
        <path d="M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path>
    </svg>
      </button>
      {isMenuOpen && (
        <div ref={menuRef} style={{ position: 'absolute', border: '1px solid black' }}>
          {React.Children.map(children, (child, index) => (
            <div key={index} onClick={() => handleItemClick(String(child))}>
              {child}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MenuButton;