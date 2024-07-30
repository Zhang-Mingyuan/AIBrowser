document.addEventListener('DOMContentLoaded', function() {
  const executeButton = document.getElementById('execute');
  const taskInput = document.getElementById('task');
  const statusDiv = document.getElementById('status');

  if (executeButton && taskInput && statusDiv) {
    executeButton.addEventListener('click', function() {
      const task = taskInput.value;
      statusDiv.textContent = 'Initiating task...';
      
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
          return;
        }
        if (tabs.length === 0) {
          statusDiv.textContent = 'Error: No active tab found. Please make sure you have an active tab open.';
          return;
        }
        chrome.runtime.sendMessage({
          action: "startTask", 
          task: task,
          url: tabs[0].url
        }, function(response) {
          if (chrome.runtime.lastError) {
            statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
            return;
          }
          if (response && response.status) {
            statusDiv.textContent = response.status;
          }
        });
      });
    });
  } else {
    console.error('One or more required elements not found in popup.html');
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Received message in popup:', request);
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    if (request.action === "executeResult") {
      statusDiv.textContent = 'Task step executed successfully. Results: ' + (request.result || 'No detailed results available');
    } else if (request.action === "error") {
      statusDiv.textContent = 'Error: ' + (request.error || 'Unknown error');
    }
  }
  sendResponse({status: "Message received by popup"});
});

console.log('Popup script loaded');
