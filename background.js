chrome.action.onClicked.addListener((tab) => {
  if (tab.url.includes('youtube.com/watch')) {
    console.log('YouTube video page detected:', tab.url);
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  }
});
