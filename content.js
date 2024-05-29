function selectHighestQualityOption() {
  console.log('Attempting to select the highest quality option...');
  const video = document.querySelector('video');
  if (!video) {
    console.log('No video element found on the page.');
    return;
  }

  const qualityOptions = [];
  const settingsButton = document.querySelector('.ytp-settings-button');
  if (settingsButton) {
    console.log('Settings button found, clicking...');
    settingsButton.click();
    const qualityMenuItem = [...document.querySelectorAll('.ytp-menuitem')].find(item =>
      item.innerText.includes('Quality')
    );

    if (qualityMenuItem) {
      console.log('Quality menu item found, clicking...');
      qualityMenuItem.click();
      const qualityItems = document.querySelectorAll('.ytp-quality-menu .ytp-menuitem');
      qualityItems.forEach(item => {
        qualityOptions.push({
          label: item.innerText.trim(),
          element: item
        });
      });

      console.log('Quality options found:', qualityOptions.map(option => option.label));

      // Select the highest quality option
      if (qualityOptions.length > 0) {
        const highestQuality = qualityOptions.sort((a, b) => {
          const qualityA = parseInt(a.label.replace(/\D/g, ''), 10);
          const qualityB = parseInt(b.label.replace(/\D/g, ''), 10);
          return qualityB - qualityA;
        })[0];
        console.log('Selecting highest quality:', highestQuality.label);
        highestQuality.element.click();
      } else {
        console.log('No quality options available.');
      }

      // Close the quality and settings menus
      closeSettingsMenu(settingsButton);
    } else {
      console.log('Quality menu item not found.');
      // Close the settings menu
      closeSettingsMenu(settingsButton);
    }
  } else {
    console.log('Settings button not found.');
  }
}

function closeSettingsMenu(button) {
  console.log('Closing settings menu...');
  if (button.getAttribute('aria-expanded') === 'true') {
    button.click();
    setTimeout(() => {
      if (button.getAttribute('aria-expanded') === 'true') {
        console.log('Retrying to close settings menu...');
        button.click();
      } else {
        console.log('Settings menu closed successfully.');
      }
    }, 500);
  } else {
    console.log('Settings menu was already closed.');
  }
}

function observeVideoChanges() {
  console.log('Setting up observer for video changes...');
  const targetNode = document.body;
  const config = { childList: true, subtree: true };

  const callback = (mutationsList, observer) => {
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(addedNode => {
          if (addedNode.nodeType === Node.ELEMENT_NODE && (addedNode.nodeName === 'VIDEO' || addedNode.querySelector('video'))) {
            console.log('New video element detected, attempting to select highest quality...');
            setTimeout(selectHighestQualityOption, 1000);
          }
        });
      }
    }
  };

  const observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
  console.log('Observer for video changes set up successfully.');
}

function observeUrlChanges() {
  console.log('Setting up observer for URL changes...');
  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      console.log('URL change detected, attempting to select highest quality...');
      lastUrl = currentUrl;
      setTimeout(selectHighestQualityOption, 1000);
    }
  }).observe(document, { subtree: true, childList: true });
  console.log('Observer for URL changes set up successfully.');
}

// Initial call to handle the first page load
console.log('Initial script run, attempting to select highest quality...');
setTimeout(selectHighestQualityOption, 1000); // Delay added to ensure elements are loaded

// Set up the observers to handle page changes and URL changes
observeVideoChanges();
observeUrlChanges();
