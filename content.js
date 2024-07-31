// window.addEventListener('load', function() {
//   chrome.runtime.sendMessage({action: "updateUrl", url: window.location.href});
// });

// console.log('Content script loaded');

// let isExecutingStep = false;

// function getPageStructure() {
//   const structure = [];

//   function getElementInfo(element) {
//     return {
//       tag: element.tagName.toLowerCase(),
//       id: element.id || '',
//       classes: Array.from(element.classList),
//       text: element.textContent.trim().substring(0, 100),
//       type: element.getAttribute('type') || '',
//       name: element.getAttribute('name') || '',
//       value: element.value || '',
//       placeholder: element.getAttribute('placeholder') || ''
//     };
//   }

//   function isVisible(element) {
//     return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
//   }

//   function traverseDOM(element) {
//     if (isVisible(element)) {
//       structure.push(getElementInfo(element));
//     }

//     for (let child of element.children) {
//       traverseDOM(child);
//     }
//   }

//   traverseDOM(document.body);
//   return JSON.stringify(structure);
// }

// chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
//   console.log('Message received in content script:', request);

//   if (request.action === "getPageContent") {
//     sendResponse({ content: getPageStructure() });
//   } else if (request.action === "executeStep") {
//     if (!isExecutingStep) {
//       isExecutingStep = true;
//       executeStep(request.instruction)
//         .then(result => {
//           console.log('Step execution completed:', result);
//           isExecutingStep = false;
//           sendResponse({ status: "Step executed", result: result });
//           chrome.runtime.sendMessage({ action: "getNextStep" });
//         })
//         .catch(error => {
//           console.error('Error in executeStep:', error);
//           isExecutingStep = false;
//           sendResponse({ status: "Error", error: error.message });
//         });
//     } else {
//       console.log('Step execution already in progress');
//       sendResponse({ status: "Step execution already in progress" });
//     }
//     return true; // Indicates we will send a response asynchronously
//   } else if (request.action === "error") {
//     console.error('Error received:', request.error);
//     sendResponse({ status: "Error received" });
//   }
// });

// async function executeStep(instruction, retries = 3) {
//   console.log('Executing instruction:', instruction);

//   const cleanedInstruction = instruction.replace(/^-\s*/, ''); // Remove leading hyphens and spaces
//   const instructions = cleanedInstruction.split('\n').map(i => i.trim()).filter(i => i);

//   try {
//     for (const singleInstruction of instructions) {
//       const [action, ...params] = singleInstruction.split(': ');
//       const fullParams = params.join(': '); // Rejoin in case there were colons in the parameters

//       console.log(`Parsed action: ${action}, params: ${fullParams}`);

//       for (let i = 0; i < retries; i++) {
//         try {
//           let result;
//           switch (action.toLowerCase()) {
//             case 'navigate to':
//               result = await navigateTo(fullParams);
//               break;
//             case 'click':
//               result = await clickElement(fullParams);
//               break;
//             case 'input':
//               const inputMatch = fullParams.match(/(.+) with (.+)/);
//               if (inputMatch) {
//                 const [, selector, text] = inputMatch;
//                 result = await inputText(selector.trim(), text.trim());
//               } else {
//                 throw new Error('Invalid input format');
//               }
//               break;
//             case 'select':
//               const selectMatch = fullParams.match(/(.+) option (.+)/);
//               if (selectMatch) {
//                 const [, selectName, optionText] = selectMatch;
//                 result = await selectOption(selectName.trim(), optionText.trim());
//               } else {
//                 throw new Error('Invalid select format');
//               }
//               break;
//             case 'wait':
//               result = await wait(parseInt(fullParams));
//               break;
//             case 'scroll':
//               result = await scrollPage(fullParams);
//               break;
//             default:
//               throw new Error(`Unrecognized instruction: ${singleInstruction}`);
//           }
//           console.log(`Executed: ${singleInstruction}. Result: ${result}`);
//           break; // Break the retry loop if successful
//         } catch (error) {
//           console.error(`Attempt ${i + 1} for "${singleInstruction}" failed:`, error);
//           if (i === retries - 1) {
//             console.error(`All ${retries} attempts failed for "${singleInstruction}". Last error:`, error);
//             throw error;
//           }
//           console.log(`Waiting before retry ${i + 2}...`);
//           await wait(1000); // Wait 1 second before retrying
//         }
//       }
//     }

//     return "All instructions executed successfully";
//   } catch (error) {
//     throw error;
//   }
// }

// function navigateTo(url) {
//   return new Promise((resolve) => {
//     console.log(`Navigating to ${url}`);
//     window.location.href = url;
//     // Add a delay to wait for the page to load completely
//     setTimeout(() => resolve(`Navigated to ${url}`), 5000);
//   });
// }

// async function clickElement(description) {
//   console.log(`Searching for element to click: ${description}`);
//   const element = await findElement(description);
//   if (element) {
//     element.click();
//     return `Clicked element: ${description}`;
//   }
//   throw new Error(`Element not found: ${description}`);
// }

// async function inputText(description, text) {
//   console.log(`Searching for input field: ${description}`);
//   const element = await findElement(description);
//   if (element && (element.tagName.toLowerCase() === 'input' && element.type !== 'submit' || element.tagName.toLowerCase() === 'textarea')) {
//     element.value = text;
//     element.dispatchEvent(new Event('input', { bubbles: true }));
//     element.dispatchEvent(new Event('change', { bubbles: true }));
//     return `Input text into ${description}: ${text}`;
//   }
//   throw new Error(`Input field not found or invalid: ${description}`);
// }

// async function selectOption(selectDescription, optionText) {
//   console.log(`Searching for select element: ${selectDescription}`);
//   const selectElement = await findElement(selectDescription);
//   if (selectElement && selectElement.tagName.toLowerCase() === 'select') {
//     const option = Array.from(selectElement.options).find(opt => opt.text.includes(optionText));
//     if (option) {
//       selectElement.value = option.value;
//       selectElement.dispatchEvent(new Event('change', { bubbles: true }));
//       return `Selected option ${optionText} in ${selectDescription}`;
//     }
//     throw new Error(`Option ${optionText} not found in ${selectDescription}`);
//   }
//   throw new Error(`Select element not found: ${selectDescription}`);
// }

// function wait(milliseconds) {
//   return new Promise((resolve) => {
//     console.log(`Waiting for ${milliseconds} milliseconds`);
//     setTimeout(() => {
//       resolve(`Waited for ${milliseconds} milliseconds`);
//     }, milliseconds);
//   });
// }

// function scrollPage(pixels) {
//   return new Promise((resolve) => {
//     console.log(`Scrolling the page by ${pixels} pixels`);
//     window.scrollBy(0, parseInt(pixels));
//     resolve(`Scrolled the page by ${pixels} pixels`);
//   });
// }

// async function findElement(description) {
//   console.log(`Searching for element: ${description}`);

//   // If the description starts with '#', it's an ID
//   if (description.startsWith('#')) {
//     const element = document.getElementById(description.slice(1));
//     if (element) return element;
//   }

//   // If the description starts with '.', it's a class
//   if (description.startsWith('.')) {
//     const element = document.querySelector(description);
//     if (element) return element;
//   }

//   // Try to find by name attribute
//   let element = document.querySelector(`[name="${description}"]`);
//   if (element) return element;

//   // Find by text content (exact match)
//   const elements = Array.from(document.body.getElementsByTagName('*'));
//   element = elements.find(el => el.textContent.trim() === description);
//   if (element) return element;

//   // If no exact match, use fuzzy matching
//   const potentialMatches = elements.filter(el => {
//     const elementText = el.textContent.toLowerCase();
//     const descriptionWords = description.toLowerCase().split(' ');
//     return descriptionWords.every(word => elementText.includes(word));
//   });

//   if (potentialMatches.length) return potentialMatches[0];

//   console.log(`No element found for description: ${description}`);
//   return null;
// }

















window.addEventListener('load', function () {
  chrome.runtime.sendMessage({ action: "updateUrl", url: window.location.href });
});

console.log('Content script loaded');

let isExecutingStep = false;

function getPageStructure() {
  const structure = [];

  function getElementInfo(element) {
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || '',
      classes: Array.from(element.classList),
      text: element.textContent.trim().substring(0, 100),
      type: element.getAttribute('type') || '',
      name: element.getAttribute('name') || '',
      value: element.value || '',
      placeholder: element.getAttribute('placeholder') || ''
    };
  }

  function isVisible(element) {
    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  }

  function traverseDOM(element) {
    if (isVisible(element)) {
      structure.push(getElementInfo(element));
    }

    for (let child of element.children) {
      traverseDOM(child);
    }
  }

  traverseDOM(document.body);
  return JSON.stringify(structure);
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log('Message received in content script:', request);

  if (request.action === "getPageContent") {
    sendResponse({ content: getPageStructure() });
  } else if (request.action === "executeStep") {
    if (!isExecutingStep) {
      isExecutingStep = true;
      executeStep(request.instruction)
        .then(result => {
          console.log('Step execution completed:', result);
          isExecutingStep = false;
          sendResponse({ status: "Step executed", result: result });
          chrome.runtime.sendMessage({ action: "getNextStep" });
        })
        .catch(error => {
          console.error('Error in executeStep:', error);
          isExecutingStep = false;
          sendResponse({ status: "Error", error: error.message });
        });
    } else {
      console.log('Step execution already in progress');
      sendResponse({ status: "Step execution already in progress" });
    }
    return true; // Indicates we will send a response asynchronously
  } else if (request.action === "error") {
    console.error('Error received:', request.error);
    sendResponse({ status: "Error received" });
  }
});

async function executeStep(instruction, retries = 3) {
  console.log('Executing instruction:', instruction);

  const cleanedInstruction = instruction.replace(/^-\s*/, ''); // Remove leading hyphens and spaces
  const instructions = cleanedInstruction.split('\n').map(i => i.trim()).filter(i => i);

  try {
    for (const singleInstruction of instructions) {
      const [action, ...params] = singleInstruction.split(': ');
      const fullParams = params.join(': '); // Rejoin in case there were colons in the parameters

      console.log(`Parsed action: ${action}, params: ${fullParams}`);

      for (let i = 0; i < retries; i++) {
        try {
          // Add a delay before attempting to execute the action
          await new Promise(resolve => setTimeout(resolve, 2000));

          let result;
          switch (action.toLowerCase()) {
            case 'navigate to':
              result = await navigateTo(fullParams);
              break;
            case 'click':
            case 'input':
            case 'select':
              result = await performActionWithAI(action.toLowerCase(), fullParams);
              break;
            case 'wait':
              result = await wait(parseInt(fullParams));
              break;
            case 'scroll':
              result = await scrollPage(fullParams);
              break;
            default:
              throw new Error(`Unrecognized instruction: ${singleInstruction}`);
          }
          console.log(`Executed: ${singleInstruction}. Result: ${result}`);
          break; // Break the retry loop if successful
        } catch (error) {
          console.error(`Attempt ${i + 1} for "${singleInstruction}" failed:`, error);
          if (i === retries - 1) {
            console.error(`All ${retries} attempts failed for "${singleInstruction}". Last error:`, error);
            throw error;
          }
          console.log(`Waiting before retry ${i + 2}...`);
          await wait(1000); // Wait 1 second before retrying
        }
      }
    }

    return "All instructions executed successfully";
  } catch (error) {
    throw error;
  }
}

function navigateTo(url) {
  return new Promise((resolve) => {
    console.log(`Navigating to ${url}`);
    window.location.href = url;
    // Add a delay to wait for the page to load completely
    setTimeout(() => resolve(`Navigated to ${url}`), 5000);
  });
}


async function performActionWithAI(action, params) {
  const pageStructure = getPageStructure();
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: "findElement",
      pageStructure: pageStructure,
      action: action,
      params: params
    }, async (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response.error) {
        reject(new Error(response.error));
        return;
      }
      const elementIdentifier = response.elementIdentifier;
      if (!elementIdentifier) {
        reject(new Error(`AI couldn't find a suitable element for action: ${action}, params: ${params}`));
        return;
      }
      try {
        const element = await findElement(elementIdentifier);
        if (element) {
          switch (action) {
            case 'click':
              element.click();
              resolve(`Clicked element: ${elementIdentifier}`);
              break;
            case 'input':
              const inputMatch = params.match(/(.+) with (.+)/);
              if (inputMatch) {
                const [, , text] = inputMatch;
                element.value = text;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                resolve(`Input text into ${elementIdentifier}: ${text}`);
              } else {
                reject(new Error('Invalid input format'));
              }
              break;
            case 'select':
              const selectMatch = params.match(/(.+) option (.+)/);
              if (selectMatch) {
                const [, , optionText] = selectMatch;
                const option = Array.from(element.options).find(opt => opt.text.includes(optionText));
                if (option) {
                  element.value = option.value;
                  element.dispatchEvent(new Event('change', { bubbles: true }));
                  resolve(`Selected option ${optionText} in ${elementIdentifier}`);
                } else {
                  reject(new Error(`Option ${optionText} not found in ${elementIdentifier}`));
                }
              } else {
                reject(new Error('Invalid select format'));
              }
              break;
            default:
              reject(new Error(`Unrecognized action: ${action}`));
          }
        } else {
          reject(new Error(`Element not found: ${elementIdentifier}`));
        }
      } catch (error) {
        reject(error);
      }
    });
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    console.log(`Waiting for ${milliseconds} milliseconds`);
    setTimeout(() => {
      resolve(`Waited for ${milliseconds} milliseconds`);
    }, milliseconds);
  });
}

function scrollPage(pixels) {
  return new Promise((resolve) => {
    console.log(`Scrolling the page by ${pixels} pixels`);
    window.scrollBy(0, parseInt(pixels));
    resolve(`Scrolled the page by ${pixels} pixels`);
  });
}

async function findElement(description) {
  if (!description) {
    console.error('Invalid element description: undefined');
    return null;
  }

  console.log(`Searching for element: ${description}`);

  // If the description starts with '#', it's an ID
  if (description.startsWith('#')) {
    const element = document.getElementById(description.slice(1));
    console.log(`Searching by ID: ${description.slice(1)}, Found: ${!!element}`);
    if (element) return element;
  }

  // If the description starts with '.', it's a class
  if (description.startsWith('.')) {
    const element = document.querySelector(description);
    console.log(`Searching by class: ${description}, Found: ${!!element}`);
    if (element) return element;
  }

  // Try to find by name attribute
  let element = document.querySelector(`[name="${description}"]`);
  console.log(`Searching by name: ${description}, Found: ${!!element}`);
  if (element) return element;

  // Find by text content (exact match)
  const elements = Array.from(document.body.getElementsByTagName('*'));
  element = elements.find(el => el.textContent.trim() === description);
  console.log(`Searching by exact text content: ${description}, Found: ${!!element}`);
  if (element) return element;

  // If no exact match, use fuzzy matching
  const potentialMatches = elements.filter(el => {
    const elementText = el.textContent.toLowerCase();
    const descriptionWords = description.toLowerCase().split(' ');
    return descriptionWords.every(word => elementText.includes(word));
  });

  console.log(`Fuzzy matching results: ${potentialMatches.length} potential matches`);
  if (potentialMatches.length) return potentialMatches[0];

  console.log(`No element found for description: ${description}`);
  return null;
}