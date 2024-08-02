console.log('Content script loaded');

let isExecutingStep = false;

// Ensure script runs after page is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', afterDOMLoaded);
} else {
  afterDOMLoaded();
}

function afterDOMLoaded() {
  console.log('DOM fully loaded');
  chrome.runtime.sendMessage({action: "updateUrl", url: window.location.href});
}

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
          // Notify background script that step is completed and to get next step
          chrome.runtime.sendMessage({ action: "stepCompleted", url: window.location.href });
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
  } else if (request.action === "pageLoaded") {
    console.log('Page loaded, checking for ongoing task');
    chrome.storage.local.get(['currentTask', 'taskCompleted'], (result) => {
      if (result.currentTask && !result.taskCompleted) {
        chrome.runtime.sendMessage({ action: "stepCompleted", url: window.location.href });
      }
    });
    sendResponse({ status: "Page load handled" });
  }
});


async function executeStep(instruction, retries = 1) {
  console.log('Executing instruction:', instruction);

  const cleanedInstruction = instruction.replace(/^-\s*/, '').trim();
  console.log('Cleaned instruction:', cleanedInstruction);

  const instructions = cleanedInstruction.split('\n').map(i => i.trim()).filter(i => i);
  try {
    for (const singleInstruction of instructions) {

      const match = singleInstruction.match(/^[-\s]*([a-zA-Z\s]+):\s*(.*)$/);
      console.log('singleInstruction:', singleInstruction)
      if (!match) {
        throw new Error(`Unrecognized instruction format: ${singleInstruction}`);
      }

      const action = match[1].toLowerCase().trim();
      const fullParams = match[2].trim();
      console.log(`Parsed action: ${action}, params: ${fullParams}`);

      for (let i = 0; i < retries; i++) {
        try {
          let result;
          switch (action) {
            case 'navigate to':
              result = await navigateTo(fullParams);
              return result; // 导航后立即返回，不执行其他指令
            case 'click':
              result = await clickElement(fullParams);
              break;
            case 'input':
              const inputMatch = fullParams.match(/(.+) with (.+)/);
              if (inputMatch) {
                const [, selector, text] = inputMatch;
                result = await inputText(selector.trim(), text.trim());
              } else {
                throw new Error('Invalid input format');
              }
              break;
            case 'select':
              const selectMatch = fullParams.match(/(.+) option (.+)/);
              if (selectMatch) {
                const [, selectName, optionText] = selectMatch;
                result = await selectOption(selectName.trim(), optionText.trim());
              } else {
                throw new Error('Invalid select format');
              }
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
          break; // 成功后跳出重试循环
        } catch (error) {
          console.error(`Attempt ${i + 1} for "${singleInstruction}" failed:`, error);
          if (i === retries - 1) {
            console.error(`All ${retries} attempts failed for "${singleInstruction}". Last error:`, error);
            throw error;
          }
          console.log(`Waiting before retry ${i + 2}...`);
          await wait(1000); // 重试前等待1秒
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
    // 不在这里解析 Promise，而是让页面加载事件来处理
  });
}

async function clickElement(description) {
  console.log(`Searching for element to click: ${description}`);
  const element = await findElement(description);
  if (element) {
    element.click();
    return `Clicked element: ${description}`;
  }
  throw new Error(`Element not found or not clickable: ${description}`);
}

async function inputText(description, text) {
  console.log(`Searching for input field: ${description}`);
  const element = await findElement(description);
  if (element && (element.tagName.toLowerCase() === 'input' && element.type !== 'submit' || element.tagName.toLowerCase() === 'textarea')) {
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return `Input text into ${description}: ${text}`;
  }
  throw new Error(`Input field not found or invalid: ${description}`);
}

async function selectOption(selectDescription, optionText) {
  console.log(`Searching for select element: ${selectDescription}`);
  const selectElement = await findElement(selectDescription);
  if (selectElement && selectElement.tagName.toLowerCase() === 'select') {
    const option = Array.from(selectElement.options).find(opt => opt.text.includes(optionText));
    if (option) {
      selectElement.value = option.value;
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      return `Selected option ${optionText} in ${selectDescription}`;
    }
    throw new Error(`Option ${optionText} not found in ${selectDescription}`);
  }
  throw new Error(`Select element not found: ${selectDescription}`);
}

/**
 * 等待指定的毫秒数
 * @param {number} milliseconds - 要等待的毫秒数
 * @returns {Promise} 返回一个Promise对象，该对象在等待期满后解决
 */
function wait(milliseconds) {
  // 创建一个新的Promise对象，用于异步操作的等待
  return new Promise((resolve) => {
    // 打印等待开始的信息
    console.log(`Waiting for ${milliseconds} milliseconds`);
    // 使用setTimeout函数来实现等待
    setTimeout(() => {
      // 等待期满后，解决Promise，并打印等待结束的信息
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

// async function findElement(description) {
//   console.log(`Searching for element: ${description}`);

//   // Function to check if element is visible
//   const isVisible = (element) => {
//     return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
//   };

//   // Handle ID selector
//   if (description.startsWith('#')) {
//     const element = document.getElementById(description.slice(1));
//     if (element && isVisible(element)) return element;
//   }

//   // Handle class selector
//   if (description.startsWith('.')) {
//     const elements = document.getElementsByClassName(description.slice(1));
//     for (let element of elements) {
//       if (isVisible(element)) return element;
//     }
//   }

//   // Handle name attribute
//   if (description.startsWith('[name="') && description.endsWith('"]')) {
//     const name = description.slice(7, -2);
//     const elements = document.getElementsByName(name);
//     for (let element of elements) {
//       if (isVisible(element)) return element;
//     }
//   }

//   // If no selector prefix, try various methods
//   if (!description.startsWith('#') && !description.startsWith('.') && !description.startsWith('[')) {
//     // Try to find by ID
//     let element = document.getElementById(description);
//     if (element && isVisible(element)) return element;

//     // Try to find by class name
//     const classElements = document.getElementsByClassName(description);
//     for (let element of classElements) {
//       if (isVisible(element)) return element;
//     }

//     // Try to find by name attribute
//     const namedElements = document.getElementsByName(description);
//     for (let element of namedElements) {
//       if (isVisible(element)) return element;
//     }

//     // Find by text content (exact match)
//     const allElements = document.body.getElementsByTagName('*');
//     for (let element of allElements) {
//       if (element.textContent.trim() === description && isVisible(element)) {
//         return element;
//       }
//     }

//     // If no exact match, use fuzzy matching
//     const descriptionWords = description.toLowerCase().split(' ');
//     for (let element of allElements) {
//       const elementText = element.textContent.toLowerCase();
//       if (descriptionWords.every(word => elementText.includes(word)) && isVisible(element)) {
//         return element;
//       }
//     }
//   }

//   console.log(`No visible element found for description: ${description}`);
//   return null;
// }

async function findElement(description) {
  console.log(`Searching for element: ${description}`);

  // If the description starts with '#', it's an ID
  if (description.startsWith('#')) {
    const element = document.getElementById(description.slice(1));
    if (element) return element;
  } else {
    const element = document.getElementById(description);
    if (element) return element;
  }

  // If the description starts with '.', it's a class
  if (description.startsWith('.')) {
    const element = document.querySelector(description);
    if (element) return element;
  } else {
    let prefixDescription = '.' + description;
    const element = document.querySelector(prefixDescription);
    if (element) return element;
  }

  // Try to find by name attribute
  let element = document.querySelector(`[name="${description}"]`);
  if (element) return element;

  // Find by text content (exact match)
  const elements = Array.from(document.body.getElementsByTagName('*'));
  element = elements.find(el => el.textContent.trim() === description);
  if (element) return element;

  // If no exact match, use fuzzy matching
  const potentialMatches = elements.filter(el => {
    const elementText = el.textContent.toLowerCase();
    const descriptionWords = description.toLowerCase().split(' ');
    return descriptionWords.every(word => elementText.includes(word));
  });

  if (potentialMatches.length) return potentialMatches[0];

  console.log(`No element found for description: ${description}`);
  return null;
}

// Add a listener for page loads
window.addEventListener('load', function () {
  chrome.runtime.sendMessage({ action: "updateUrl", url: window.location.href });
});