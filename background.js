// const DASHSCOPE_API_KEY = '';

// let currentTask = null;
// let currentStep = 0;
// let currentUrl = '';
// let taskCompleted = false;
// let isTaskRunning = false;

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   console.log('Background script received message:', request);

//   if (request.action === "startTask") {
//     if (!isTaskRunning) {
//       currentTask = request.task;
//       currentStep = 0;
//       currentUrl = request.url;
//       taskCompleted = false;
//       isTaskRunning = true;
//       getNextStep();
//       sendResponse({status: "Task started"});
//     } else {
//       sendResponse({status: "A task is already running"});
//     }
//   } else if (request.action === "getNextStep") {
//     if (isTaskRunning && !taskCompleted) {
//       getNextStep();
//       sendResponse({status: "Getting next step"});
//     } else if (taskCompleted) {
//       sendResponse({status: "Task already completed"});
//     } else {
//       sendResponse({status: "No task is currently running"});
//     }
//   } else if (request.action === "updateUrl") {
//     currentUrl = request.url;
//     if (isTaskRunning && !taskCompleted) {
//       getNextStep();
//     }
//     sendResponse({status: "URL updated"});
//   }

//   return true;  // Indicates we will send a response asynchronously
// });

// function getNextStep() {
//   if (!isTaskRunning || taskCompleted) return;

//   chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
//     if (chrome.runtime.lastError) {
//       console.error('Error querying tabs:', chrome.runtime.lastError);
//       return;
//     }
//     if (tabs.length === 0) {
//       console.error('No active tab found');
//       return;
//     }
//     chrome.tabs.sendMessage(tabs[0].id, {action: "getPageContent"}, function(response) {
//       if (chrome.runtime.lastError) {
//         console.error('Error sending message to content script:', chrome.runtime.lastError);
//         return;
//       }
//       if (!response) {
//         console.error('No response from content script');
//         return;
//       }

//       const pageStructure = truncateContent(response.content);
//       getQwenInstructions(currentTask, pageStructure, currentStep)
//         .then(result => {
//           console.log('API call result:', result);
//           if (result.instructions.toLowerCase().includes('task completed')) {
//             taskCompleted = true;
//             isTaskRunning = false;
//             chrome.tabs.sendMessage(tabs[0].id, {
//               action: "executeStep",
//               instruction: "Task Completed"
//             }, function(response) {
//               if (chrome.runtime.lastError) {
//                 console.error('Error sending Task Completed message:', chrome.runtime.lastError);
//               }
//             });
//           } else {
//             chrome.tabs.sendMessage(tabs[0].id, {
//               action: "executeStep",
//               instruction: result.instructions
//             }, function(response) {
//               if (chrome.runtime.lastError) {
//                 console.error('Error sending executeStep message:', chrome.runtime.lastError);
//               }
//             });
//           }
//         })
//         .catch(error => {
//           console.error('Error in getQwenInstructions:', error);
//           let errorMessage = error.message;
//           if (error.rawResponse) {
//             try {
//               const parsedError = JSON.parse(error.rawResponse);
//               errorMessage = parsedError.message || errorMessage;
//             } catch (e) {
//               console.error('Failed to parse error response:', e);
//             }
//           }
//           chrome.tabs.sendMessage(tabs[0].id, {
//             action: "error",
//             error: errorMessage
//           }, function(response) {
//             if (chrome.runtime.lastError) {
//               console.error('Error sending error message:', chrome.runtime.lastError);
//             }
//           });
//         });
//     });
//   });
// }
// function truncateContent(content, maxLength = 29000) {
//   if (content.length > maxLength) {
//     return content.substring(0, maxLength);
//   }
//   return content;
// }

// async function getQwenInstructions(task, pageStructure, step) {
//   const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

//   const payload = {
//     model: "qwen-plus",
//     input: {
//       messages: [
//         {
//           role: "system",
//           content: `You are an AI assistant for automating web tasks. Analyze the given page structure and provide the next step instruction in a machine-readable format. Use the following format for instructions:
//           - Navigate to: <URL>
//           - Click: <Element Description>
//           - Input: <Element Description> with <Text>
//           - Select: <Element Description> option <Option Text>
//           - Wait: <Milliseconds>
//           - Scroll: <Pixels>
//           Only provide one step at a time. For element descriptions, use the most unique and specific identifier available (id, class, name, or text content). Prefer using text content for buttons and links when available.`
//         },
//         {
//           role: "user",
//           content: `Task: ${task}\nCurrent step: ${step}\nCurrent URL: ${currentUrl}\nPage structure: ${pageStructure}\nPlease provide the next step instruction:`
//         }
//       ]
//     },
//     parameters: {}
//   };

//   try {
//     console.log('Sending request to Qwen API with payload:', JSON.stringify(payload, null, 2));
//     const response = await fetch(url, {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify(payload)
//     });

//     const data = await response.json();
//     console.log('Received data from Qwen API:', JSON.stringify(data, null, 2));

//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(data)}`);
//     }

//     if (!data.output || !data.output.text) {
//       console.error('Unexpected API response:', JSON.stringify(data, null, 2));
//       throw new Error("Unexpected API response format: " + JSON.stringify(data));
//     }

//     const instructions = data.output.text.trim();
//     if (!instructions || instructions === '') {
//       throw new Error("No instructions received from AI");
//     }

//     currentStep++;
//     return {instructions: instructions, rawResponse: JSON.stringify(data)};
//   } catch (error) {
//     console.error('Error in API call:', error);
//     throw {
//       message: error.message,
//       details: error.stack,
//       rawResponse: error.rawResponse || 'No raw response available'
//     };
//   }
// }










const DASHSCOPE_API_KEY = '';

let currentTask = null;
let currentStep = 0;
let currentUrl = '';
let taskCompleted = false;
let isTaskRunning = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request);

  if (request.action === "startTask") {
    if (!isTaskRunning) {
      currentTask = request.task;
      currentStep = 0;
      currentUrl = request.url;
      taskCompleted = false;
      isTaskRunning = true;
      getNextStep();
      sendResponse({status: "Task started"});
    } else {
      sendResponse({status: "A task is already running"});
    }
  } else if (request.action === "getNextStep") {
    if (isTaskRunning && !taskCompleted) {
      getNextStep();
      sendResponse({status: "Getting next step"});
    } else if (taskCompleted) {
      sendResponse({status: "Task already completed"});
    } else {
      sendResponse({status: "No task is currently running"});
    }
  } else if (request.action === "updateUrl") {
    currentUrl = request.url;
    if (isTaskRunning && !taskCompleted) {
      getNextStep();
    }
    sendResponse({status: "URL updated"});
  } else if (request.action === "findElement") {
    findElementWithAI(request.pageStructure, request.action, request.params)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({error: error.message}));
    return true;  // Indicates we will send a response asynchronously
  }

  return true;  // Indicates we will send a response asynchronously
});

function getNextStep() {
  if (!isTaskRunning || taskCompleted) return;

  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (chrome.runtime.lastError) {
      console.error('Error querying tabs:', chrome.runtime.lastError);
      return;
    }
    if (tabs.length === 0) {
      console.error('No active tab found');
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, {action: "getPageContent"}, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Error sending message to content script:', chrome.runtime.lastError);
        return;
      }
      if (!response) {
        console.error('No response from content script');
        return;
      }

      const pageStructure = truncateContent(response.content);
      getQwenInstructions(currentTask, pageStructure, currentStep)
        .then(result => {
          console.log('API call result:', result);
          if (result.instructions.toLowerCase().includes('task completed')) {
            taskCompleted = true;
            isTaskRunning = false;
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "executeStep",
              instruction: "Task Completed"
            }, function(response) {
              if (chrome.runtime.lastError) {
                console.error('Error sending Task Completed message:', chrome.runtime.lastError);
              }
            });
          } else {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "executeStep",
              instruction: result.instructions
            }, function(response) {
              if (chrome.runtime.lastError) {
                console.error('Error sending executeStep message:', chrome.runtime.lastError);
              }
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
          }, function(response) {
            if (chrome.runtime.lastError) {
              console.error('Error sending error message:', chrome.runtime.lastError);
            }
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

async function getQwenInstructions(task, pageStructure, step) {
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
          Only provide one step at a time. For element descriptions, use the most unique and specific identifier available (id, class, name, or text content). Prefer using text content for buttons and links when available.`
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
    return {instructions: instructions, rawResponse: JSON.stringify(data)};
  } catch (error) {
    console.error('Error in API call:', error);
    throw {
      message: error.message,
      details: error.stack,
      rawResponse: error.rawResponse || 'No raw response available'
    };
  }
}

async function findElementWithAI(pageStructure, action, params) {
  const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

  const payload = {
    model: "qwen-plus",
    input: {
      messages: [
        {
          role: "system",
          content: `You are an AI assistant for finding elements on a web page. Analyze the given page structure and find the most suitable element for the requested action. Return the element's identifier in a format that can be used to locate it on the page.`
        },
        {
          role: "user",
          content: `Action: ${action}\nParameters: ${params}\nPage structure: ${pageStructure}\nPlease find the most suitable element and return its identifier:`
        }
      ]
    },
    parameters: {}
  };

  try {
    console.log('Sending request to Qwen API for element finding:', JSON.stringify(payload, null, 2));
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Received data from Qwen API for element finding:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(data)}`);
    }

    if (!data.output || !data.output.text) {
      console.error('Unexpected API response:', JSON.stringify(data, null, 2));
      throw new Error("Unexpected API response format: " + JSON.stringify(data));
    }

    const elementIdentifier = data.output.text.trim();
    if (!elementIdentifier || elementIdentifier === '') {
      throw new Error("No element identifier received from AI");
    }

    return {elementIdentifier: elementIdentifier};
  } catch (error) {
    console.error('Error in findElementWithAI:', error);
    throw {
      message: error.message,
      details: error.stack,
      rawResponse: error.rawResponse || 'No raw response available'
    };
  }
}