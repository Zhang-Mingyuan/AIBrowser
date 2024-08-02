const DASHSCOPE_API_KEY = '';

let currentTask = null;
let currentStep = 0;
let currentUrl = '';
let taskCompleted = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request);

  if (request.action === "startTask") {
    chrome.storage.local.set({
      currentTask: request.task,
      currentStep: 0,
      currentUrl: request.url,
      taskCompleted: false
    }, () => {
      getNextStep();
      sendResponse({ status: "Task started" });
    });
  } else if (request.action === "stepCompleted") {
    chrome.storage.local.get(['currentStep', 'currentUrl'], (result) => {
      chrome.storage.local.set({
        currentStep: result.currentStep + 1,
        currentUrl: request.url
      }, () => {
        getNextStep();
        sendResponse({ status: "Getting next step" });
      });
    });
  } else if (request.action === "updateUrl") {
    chrome.storage.local.set({ currentUrl: request.url }, () => {
      sendResponse({ status: "URL updated" });
    });
  }

  return true;  // Indicates we will send a response asynchronously
});

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0) {  // Only execute for the main frame
    console.log('Page loaded:', details.url);
    chrome.tabs.sendMessage(details.tabId, { action: "pageLoaded", url: details.url });
  }
});


function getNextStep() {
  chrome.storage.local.get(['currentTask', 'currentStep', 'currentUrl', 'taskCompleted'], (result) => {
    if (result.taskCompleted) return;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError);
        return;
      }
      if (tabs.length === 0) {
        console.error('No active tab found');
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: "getPageContent" }, function (response) {
        if (chrome.runtime.lastError) {
          console.error('Error sending message to content script:', chrome.runtime.lastError);
          return;
        }
        if (!response) {
          console.error('No response from content script');
          return;
        }

        const pageStructure = truncateContent(response.content);
        getQwenInstructions(result.currentTask, pageStructure, result.currentStep, result.currentUrl)
          .then(result => {
            console.log('API call result:', result);
            if (result.instructions.toLowerCase().includes('task completed')) {
              chrome.storage.local.set({ taskCompleted: true }, () => {
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: "executeStep",
                  instruction: "Task Completed"
                });
              });
            } else {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "executeStep",
                instruction: result.instructions
              });
            }
          })
          .catch(error => {
            console.error('Error in getQwenInstructions:', error);
            let errorMessage = error.message;
            if (error.rawResponse) {
              try {
                const parsedError = JSON.parse(error.rawResponse);
                errorMessage = parsedError.message || errorMessage;
              } catch (e) {
                console.error('Failed to parse error response:', e);
              }
            }
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "error",
              error: errorMessage
            });
          });
      });
    });
  });
}


function truncateContent(content, maxLength = 29000) {
  if (content.length > maxLength) {
    return content.substring(0, maxLength);
  }
  return content;
}

async function getQwenInstructions(task, pageStructure, step, currentUrl) {
  const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

  const payload = {
    model: "qwen-plus",
    input: {
      messages: [
        {
          role: "system",
          content: `You are an AI assistant for automating web tasks. Analyze the given page structure and provide the next step instruction in a machine-readable format. Use the following format for instructions:
          - Navigate to: <URL>
          - Click: <Element Description>
          - Input: <Element Description> with <Text>
          - Select: <Element Description> option <Option Text>
          - Wait: <Milliseconds>
          - Scroll: <Pixels>
            Only provide one step at a time. For element descriptions, use the most unique and specific identifier available (id, class, name, or text content). Always include appropriate selector prefixes:
            - Use '#' for IDs (e.g., #submit-button)
            - Use '.' for classes (e.g., .input-field)
            - Use '[name=""]' for name attributes (e.g., [name="username"])
            - Use no prefix for text content or generic descriptions
          Prefer using text content for buttons and links when available.`
        },
        {
          role: "user",
          content: `Task: ${task}\nCurrent step: ${step}\nCurrent URL: ${currentUrl}\nPage structure: ${pageStructure}\nPlease provide the next step instruction:`
        }
      ]
    },
    parameters: {}
  };

  try {
    console.log('Sending request to Qwen API with payload:', JSON.stringify(payload, null, 2));
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Received data from Qwen API:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(data)}`);
    }

    if (!data.output || !data.output.text) {
      console.error('Unexpected API response:', JSON.stringify(data, null, 2));
      throw new Error("Unexpected API response format: " + JSON.stringify(data));
    }

    const instructions = data.output.text.trim();
    if (!instructions || instructions === '') {
      throw new Error("No instructions received from AI");
    }

    currentStep++;
    return { instructions: instructions, rawResponse: JSON.stringify(data) };
  } catch (error) {
    console.error('Error in API call:', error);
    throw {
      message: error.message,
      details: error.stack,
      rawResponse: error.rawResponse || 'No raw response available'
    };
  }
}