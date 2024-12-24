const socket = io();
const canvasContainer = document.getElementById('canvasContainer');
const settingsModal = document.getElementById('settingsModal');
const openSettings = document.getElementById('openSettings');
const closeSettings = document.getElementById('closeSettings');
const addAreaButton = document.getElementById('addAreaButton');
const areaList = document.getElementById('areaList');
const boxForm = document.getElementById('boxForm');

// Scaling factor
let metersToPixels = 50;

// Global area positioning
let nextAreaY = 80; // Initial vertical position (below the menu)
const areaSpacingY = 40; // Increased space between areas

let areas = []; // Global list of areas to track and modify
let lockedBoxes = {}; // Track locked boxes

// Scroll settings
const scrollThreshold = 50; // Distance from edges to trigger scrolling
const scrollSpeed = 10; // Speed of scrolling
let scrollInterval = null; // Interval to handle scrolling

// Open settings modal
openSettings.addEventListener('click', () => {
    settingsModal.classList.add('active');
});

// Close settings modal
closeSettings.addEventListener('click', () => {
    settingsModal.classList.remove('active');
});

// Add a new area
addAreaButton.addEventListener('click', () => {
    const areaName = prompt("Enter area name:");
    if (!areaName) return;

    const newArea = {
        name: areaName,
        width: 800,
        height: 600,
        x: 10, // Fixed horizontal position
        y: nextAreaY, // Positioned below the previous area
    };

    // Emit the create_area event to the server
    socket.emit('create_area', newArea);
});

// Adjust all areas' positions dynamically
const adjustAreaPositions = () => {
    let currentY = 80; // Start below the menu
    areas.forEach((area) => {
        area.y = currentY;
        currentY += area.height + areaSpacingY;
    });
};

// Enable scrolling when dragging near edges
const enableScrollOnDrag = (event) => {
    const rect = canvasContainer.getBoundingClientRect();

    // Stop any existing scrolling
    clearInterval(scrollInterval);

    // Check if dragging near the top or bottom edges
    if (event.clientY - rect.top < scrollThreshold) {
        scrollInterval = setInterval(() => {
            canvasContainer.scrollTop -= scrollSpeed;
        }, 50);
    } else if (rect.bottom - event.clientY < scrollThreshold) {
        scrollInterval = setInterval(() => {
            canvasContainer.scrollTop += scrollSpeed;
        }, 50);
    } else {
        clearInterval(scrollInterval);
    }
};

// Clear scrolling when drag ends
const clearScrollOnDragEnd = () => {
    clearInterval(scrollInterval);
};

// Render areas dynamically
const renderAreas = () => {
    adjustAreaPositions(); // Adjust positions dynamically
    canvasContainer.innerHTML = ''; // Clear canvas

    areas.forEach((area, index) => {
        // Create the area label (name displayed above the area)
        const areaLabel = document.createElement('div');
        areaLabel.classList.add('area-label');
        areaLabel.textContent = area.name;
        areaLabel.style.position = 'absolute';
        areaLabel.style.left = `${area.x}px`;
        areaLabel.style.top = `${area.y - 30}px`; // Position above the area
        areaLabel.style.fontWeight = 'bold';
        areaLabel.style.fontSize = '20px'; // Increased font size for labels

        // Create the area itself
        const areaDiv = document.createElement('div');
        areaDiv.classList.add('area');
        areaDiv.style.position = 'absolute';
        areaDiv.style.width = `${area.width}px`;
        areaDiv.style.height = `${area.height}px`;
        areaDiv.style.left = `${area.x}px`;
        areaDiv.style.top = `${area.y}px`;

        // Append area label and area div to the canvas
        canvasContainer.appendChild(areaLabel);
        canvasContainer.appendChild(areaDiv);
    });

    // Update settings modal with areas
    areaList.innerHTML = '';
    areas.forEach((area, index) => {
        const areaItem = document.createElement('div');
        areaItem.classList.add('area-item');
        areaItem.textContent = `${area.name} (${area.width / metersToPixels}m x ${area.height / metersToPixels}m)`;

        const modifyButton = document.createElement('button');
        modifyButton.textContent = 'Modify';
        modifyButton.addEventListener('click', () => {
            const newWidth = prompt('Enter new width (meters):', area.width / metersToPixels);
            const newHeight = prompt('Enter new height (meters):', area.height / metersToPixels);
            if (newWidth && newHeight) {
                const updatedArea = {
                    name: area.name,
                    width: parseInt(newWidth) * metersToPixels,
                    height: parseInt(newHeight) * metersToPixels
                };
                socket.emit('update_area', updatedArea);
            }
        });

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete the area "${area.name}"?`)) {
                socket.emit('delete_area', { name: area.name });
            }
        });

        areaItem.appendChild(modifyButton);
        areaItem.appendChild(deleteButton);
        areaList.appendChild(areaItem);
    });
};

// Handle area updates from the server
socket.on('update_areas', (serverAreas) => {
    areas = serverAreas; // Update the local areas list
    renderAreas(); // Re-render areas on the canvas
});

// Add a box
boxForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('name').value;
    const width = parseFloat(document.getElementById('width').value) * metersToPixels;
    const height = parseFloat(document.getElementById('height').value) * metersToPixels;
    const color = document.getElementById('color').value;
    const isCircle = document.getElementById('isCircle').checked;

    const box = {
        name,
        width,
        height,
        x: 10,
        y: 10,
        color,
        isCircle,
        comment: "", // Optional comment
        rotation: 0 // Default rotation
    };

    socket.emit('create_box', box);
    boxForm.reset();
});

// Render boxes dynamically
let activeTooltip = null; // Track the currently active tooltip

socket.on('update_boxes', (boxes) => {
    canvasContainer.querySelectorAll('.box').forEach((box) => box.remove());

    boxes.forEach((box) => {
        const div = document.createElement('div');
        div.classList.add('box');
        div.style.position = 'absolute';
        div.style.width = `${box.width}px`;
        div.style.height = `${box.height}px`;
        div.style.left = `${box.x}px`;
        div.style.top = `${box.y}px`;
        div.style.backgroundColor = box.color || 'blue';
        div.style.border = box.locked ? '2px solid red' : '2px solid black';
        div.style.borderRadius = box.isCircle ? '50%' : '0';
        div.textContent = box.name;
        div.setAttribute('draggable', true); // Make the box draggable
        // Set rotation
        div.style.transform = `rotate(${box.rotation || 0}deg)`;

        canvasContainer.appendChild(div);

        // Create a custom tooltip for comments
        const tooltip = document.createElement('div');
        tooltip.classList.add('tooltip');
        tooltip.style.position = 'absolute';
        tooltip.style.backgroundColor = 'black';
        tooltip.style.color = 'white';
        tooltip.style.padding = '5px';
        tooltip.style.borderRadius = '3px';
        tooltip.style.visibility = 'hidden';
        tooltip.style.opacity = '0';
        tooltip.style.transition = 'visibility 0s, opacity 0.2s';
        tooltip.style.zIndex = '10000'; // Ensure tooltip is on top
        tooltip.textContent = box.comment;

        if (box.comment && box.comment.trim() !== '') {
            div.addEventListener('mouseenter', (event) => {
                if (activeTooltip) {
                    activeTooltip.style.visibility = 'hidden';
                    activeTooltip.style.opacity = '0';
                    if (document.body.contains(activeTooltip)) {
                        document.body.removeChild(activeTooltip);
                    }
                }
                activeTooltip = tooltip; // Set the current tooltip as active

                tooltip.style.visibility = 'visible';
                tooltip.style.opacity = '1';
                tooltip.style.left = `${event.pageX + 10}px`; // Position tooltip near mouse
                tooltip.style.top = `${event.pageY + 10}px`;
                document.body.appendChild(tooltip); // Append tooltip to body to ensure it stays on top
            });

            
            div.addEventListener('mouseleave', () => {
                if (tooltip === activeTooltip) {
                    tooltip.style.visibility = 'hidden';
                    tooltip.style.opacity = '0';
                    if (document.body.contains(tooltip)) {
                        document.body.removeChild(tooltip);
                    }
                    activeTooltip = null; // Clear the active tooltip
                }
            });
        }

        // Drag events
        div.addEventListener('dragstart', (event) => {
            if (lockedBoxes[box.name]) return;

            const rect = div.getBoundingClientRect();
            dragOffsetX = event.clientX - rect.left;
            dragOffsetY = event.clientY - rect.top;

            event.dataTransfer.setData('text/plain', JSON.stringify(box));
            event.dataTransfer.effectAllowed = 'move'; // Ensure move effect is allowed
        });

        div.addEventListener('dragend', (event) => {
            if (lockedBoxes[box.name]) return;

            const canvasRect = canvasContainer.getBoundingClientRect();
            const dropX = event.clientX - canvasRect.left - dragOffsetX + canvasContainer.scrollLeft;
            const dropY = event.clientY - canvasRect.top - dragOffsetY + canvasContainer.scrollTop;

            socket.emit('update_box_position', {
                name: box.name,
                x: dropX,
                y: dropY,
            });

            clearScrollOnDragEnd(); // Clear scrolling
        });



        // Right-click menu
        div.addEventListener('contextmenu', (event) => {
            event.preventDefault();

            const menu = document.createElement('div');
            menu.style.position = 'absolute';
            menu.style.left = `${event.pageX}px`;
            menu.style.top = `${event.pageY}px`;
            menu.style.backgroundColor = 'white';
            menu.style.border = '1px solid black';
            menu.style.padding = '5px';
            menu.style.zIndex = '1000';

            const lockOption = document.createElement('div');
            lockOption.textContent = lockedBoxes[box.name] ? 'Unlock' : 'Lock';
            lockOption.addEventListener('click', () => {
                lockedBoxes[box.name] = !lockedBoxes[box.name];
                div.style.border = lockedBoxes[box.name] ? '2px solid red' : '2px solid black'; // Update outline color
                document.body.removeChild(menu);
            });
            menu.appendChild(lockOption);

            const deleteOption = document.createElement('div');
            deleteOption.textContent = 'Delete';
            deleteOption.addEventListener('click', () => {
                socket.emit('delete_box', { name: box.name });
                document.body.removeChild(menu);
            });
            menu.appendChild(deleteOption);

            const rotateOption = document.createElement('div');
            rotateOption.textContent = 'Rotate';
            rotateOption.addEventListener('click', () => {
                const degrees = parseInt(prompt('Enter rotation in degrees:', box.rotation));
                if (!isNaN(degrees)) {
                    socket.emit('update_box_rotation', { name: box.name, rotation: degrees });
                }
                document.body.removeChild(menu);
            });
            menu.appendChild(rotateOption);

            const commentOption = document.createElement('div');
            commentOption.textContent = 'Add Comment';
            commentOption.addEventListener('click', () => {
                const comment = prompt('Enter a comment:', box.comment || '');
                socket.emit('update_box_comment', { name: box.name, comment });
                document.body.removeChild(menu);
            });
            menu.appendChild(commentOption);

            document.body.appendChild(menu);

            const closeMenu = () => {
                document.body.removeChild(menu);
                document.removeEventListener('click', closeMenu);
            };

            document.addEventListener('click', closeMenu);
        });


        canvasContainer.appendChild(div);
    });
});
