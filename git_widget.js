function fetchLastCommit (username, repo) {
  return fetch(`https://api.github.com/repos/${username}/${repo}/commits`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to load data: ' + response.statusText)
      }
      return response.json()
    })
    .catch(error => {
      throw new Error('Network error: ' + error.message)
    })
}

function renderLastCommit (elementId, commitData) {
  const element = document.getElementById(elementId)
  if (!element) {
    console.error('Element not found:', elementId)
    return
  }
  const [username, repo] = elementId.replace('git-widget-', '').split('-')
  element.className = 'repo-widget'
  element.innerHTML = `
    <div class="repo-title">
        <h3><a href="https://github.com/${username}/${repo}" target="_blank">${username}/${repo}</a></h3>
        <button onclick="removeRepo('${elementId}')">X</button>
    </div>
    <div>
        <span class="commit-date">${timeAgo(commitData.commit.author.date)} - ${commitData.commit.author.date}</span>
    </div>
    <div>
        <a href="${commitData.html_url}" target="_blank" class="commit-sha">${commitData.sha}</a>
    </div>
    <div>
        <a href="${commitData.author.html_url}" target="_blank" class="commit-author">${commitData.commit.author.name}</a>
    </div>
    <div class="commit-message-wrapper">
        <span class="commit-message">${commitData.commit.message}</span>
    </div>
  `
}

function removeRepo (elementId) {
  const [username, repo] = elementId.replace('git-widget-', '').split('-')
  const repoString = `${username}/${repo}`
  removeRepoFromList(repoString)
  document.getElementById(elementId).remove()
}

function initGitWidget (elementId, username, repo) {
  fetchLastCommit(username, repo)
    .then(commits => {
      if (commits.length > 0) {
        renderLastCommit(elementId, commits[0])
      } else {
        console.error('No commit data available')
      }
    })
    .catch(error => {
      console.error('Error fetching commit data:', error)
    })
}

function renderRepos (repos, containerElement) {
  if (!Array.isArray(repos)) {
    console.error('Invalid input: repos is not an array')
    return
  }
  repos.forEach(repoString => {
    const [username, repo] = repoString.split('/')
    const widgetId = `git-widget-${username}-${repo}`
    let widgetElement = document.getElementById(widgetId)

    if (!widgetElement) {
      widgetElement = document.createElement('div')
      widgetElement.id = widgetId
      containerElement.appendChild(widgetElement)
    }

    initGitWidget(widgetId, username, repo)
  })
}

function renderAddRepo (containerId) {
  const container = document.getElementById(containerId)
  const inputWrapper = document.createElement('div')
  inputWrapper.className = 'add-repo-wrapper'

  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'Enter "user/repo" to add or leave empty to reload'
  input.className = 'repo-input'

  const addButton = document.createElement('button')
  addButton.textContent = 'Reload' // Default text
  addButton.onclick = () => addRepoFunction(input, container)

  input.addEventListener('keyup', event => {
    addButton.textContent = input.value ? 'Add Repo' : 'Reload'
    if (event.key === 'Enter') {
      addRepoFunction(input, container)
    }
  })

  inputWrapper.appendChild(input)
  inputWrapper.appendChild(addButton)
  container.appendChild(inputWrapper)
}

function addRepoFunction (input, container) {
  const repoString = input.value
  if (!repoString) {
    location.reload() // Reload the page if the input is empty
  } else if (repoString.includes('/')) {
    addRepoToList(repoString)
    const repoList = getRepoList()
    renderRepos(repoList, container)
    input.value = '' // Clear input after adding
  } else {
    alert('Please enter a valid "user/repo" string.')
  }
}

function getRepoList () {
  const urlParams = new URLSearchParams(window.location.search)
  const repoListParam = urlParams.get('repoList')
  return repoListParam ? JSON.parse(repoListParam) : []
}

function addRepoToList (repoString) {
  const repoList = getRepoList()
  if (!repoList.includes(repoString)) {
    repoList.push(repoString)
    updateQueryString(repoList)
  }
}

function removeRepoFromList (repoString) {
  let repoList = getRepoList()
  repoList = repoList.filter(repo => repo !== repoString)
  updateQueryString(repoList)
}

function updateQueryString (repoList) {
  const urlParams = new URLSearchParams(window.location.search)
  urlParams.set('repoList', JSON.stringify(repoList))
  window.location.search = urlParams.toString()
}

function timeAgo (input) {
  // https://stackoverflow.com/a/69122877
  const date = (input instanceof Date) ? input : new Date(input)
  const formatter = new Intl.RelativeTimeFormat('en')
  const ranges = {
    years: 3600 * 24 * 365,
    months: 3600 * 24 * 30,
    weeks: 3600 * 24 * 7,
    days: 3600 * 24,
    hours: 3600,
    minutes: 60,
    seconds: 1
  }
  const secondsElapsed = (date.getTime() - Date.now()) / 1000
  for (const key in ranges) {
    if (ranges[key] < Math.abs(secondsElapsed)) {
      const delta = secondsElapsed / ranges[key]
      return formatter.format(Math.round(delta), key)
    }
  }
}
