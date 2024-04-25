function init () {
  const containerElement = document.getElementById('container')
  const repoList = RepoManager.getRepoList()
  console.warn(`repos: ${repoList}`)
  renderRepos(repoList, containerElement)
  Controls.renderControls('controls')
}

async function renderRepos (repos, containerElement) {
  if (!Array.isArray(repos)) {
    console.error('Invalid input: repos is not an array')
    return
  }
  const fetchPromises = repos.map(repoString => {
    const widget = new Widget(repoString)
    return widget.initialize()
  })

  const results = await Promise.all(fetchPromises)
  const sortByDate = new URLSearchParams(window.location.search).get('sort') === 'date'
  if (sortByDate) {
    results.sort((a, b) => new Date(a.commitDate) - new Date(b.commitDate))
  }

  const fragment = document.createDocumentFragment()
  results.forEach(result => {
    if (result.widgetElement) {
      fragment.appendChild(result.widgetElement)
    }
  })
  containerElement.appendChild(fragment)
}

class Widget {
  constructor (repoString) {
    this.repo = Repo.fromString(repoString)
  }

  async initialize () {
    try {
      const commits = await this.fetchLastCommit()
      if (commits.length > 0) {
        const widgetElement = this.render(commits[0])
        return { elementId: this.repo.getElementId(), commitDate: commits[0].commit.author.date, widgetElement }
      } else {
        console.error('No commit data available')
        this.repo.removeRepo()
      }
    } catch (error) {
      console.error('Error fetching commit data:', error)
      this.repo.removeRepo()
    }
  }

  async fetchLastCommit () {
    try {
      const response = await fetch(`https://api.github.com/repos/${this.repo.getUser()}/${this.repo.getRepo()}/commits`)
      if (!response.ok) {
        throw new Error('Failed to load data: ' + response.statusText)
      }
      return await response.json()
    } catch (error) {
      throw new Error('Network error: ' + error.message)
    }
  }

  render (commitData) {
    const element = document.createElement('div')
    element.id = this.repo.getElementId()
    const collapsed = new URLSearchParams(window.location.search).get('collapsed') === 'true'
    element.className = collapsed ? 'repo-widget collapsed' : 'repo-widget'
    element.innerHTML = `
      <div class="repo-title">
          <h3><a href="https://github.com/${this.repo.getUser()}/${this.repo.getRepo()}" target="_blank">${this.repo.getRepoString()}</a></h3>
          <button onclick="Repo.removeRepoByElementId('${this.repo.getElementId()}')">X</button>
      </div>
      <div class="commit-date">
          <a href="${commitData.html_url}" target="_blank" class="human-date">${Utils.timeAgo(commitData.commit.author.date)}</a>
          <span class="iso-date"> - ${commitData.commit.author.date}</span>
      </div>
      <div class="commit-sha">
          <a href="${commitData.html_url}" target="_blank">${commitData.sha}</a>
      </div>
      <div class="commit-author">
          <a href="${commitData.author.html_url}" target="_blank">${commitData.commit.author.name}</a>
      </div>
      <div class="commit-message-wrapper">
          <span class="commit-message">${commitData.commit.message}</span>
      </div>
    `
    return element
  }
}

class Repo {
  constructor (user, repo) {
    this.user = user
    this.repo = repo
    this.repoString = `${user}/${repo}`
    this.elementId = `git-widget|${encodeURIComponent(user)}|${encodeURIComponent(repo)}`
  }

  getElementId () {
    return this.elementId
  }

  getUser () {
    return this.user
  }

  getRepo () {
    return this.repo
  }

  getRepoString () {
    return this.repoString
  }

  removeRepo () {
    RepoManager.removeRepoFromList(this.repoString)
    const element = document.getElementById(this.elementId)
    if (element) {
      element.remove()
    }
  }

  static fromElementId (elementId) {
    const parts = elementId.split('|') // git-widget|user|repo
    const user = decodeURIComponent(parts[1])
    const repo = decodeURIComponent(parts[2])
    return new Repo(user, repo)
  }

  static fromString (repoString) {
    const [user, repo] = repoString.split('/')
    return new Repo(user, repo)
  }

  static removeRepoByElementId (elementId) {
    const repo = Repo.fromElementId(elementId)
    repo.removeRepo()
  }
}

class Controls {
  static renderControls (containerId) {
    const container = document.getElementById(containerId)
    const inputWrapper = document.createElement('div')
    inputWrapper.className = 'add-repo-wrapper'

    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Enter "user/repo" to add or leave empty to reload'
    input.className = 'repo-input'

    const addButton = document.createElement('button')
    addButton.textContent = 'Reload' // Default text
    addButton.onclick = () => Controls.inputButtonListener(input, container)

    const toggleButton = document.createElement('button')
    const params = new URLSearchParams(window.location.search)
    const isCollapsed = params.get('collapsed') === 'true'
    toggleButton.textContent = isCollapsed ? 'Expand' : 'Collapse'
    toggleButton.onclick = () => {
      params.set('collapsed', !isCollapsed)
      window.location.search = params.toString()
      toggleButton.textContent = !isCollapsed ? 'Expand' : 'Collapse'
    }
    input.addEventListener('keyup', event => {
      addButton.textContent = input.value ? 'Add Repo' : 'Reload'
      if (event.key === 'Enter') {
        Controls.inputButtonListener(input, container)
      }
    })

    inputWrapper.appendChild(input)
    inputWrapper.appendChild(addButton)
    inputWrapper.appendChild(toggleButton)
    container.appendChild(inputWrapper)
  }

  static inputButtonListener (input, container) {
    const repoString = input.value
    if (!repoString) {
      window.location.reload() // Reload the page if the input is empty
    } else if (repoString.includes('/')) {
      RepoManager.addRepoToList(repoString)
      const repoList = RepoManager.getRepoList()
      renderRepos(repoList, container)
      input.value = '' // Clear input after adding
    } else {
      window.alert('Please enter a valid "user/repo" string.')
    }
  }
}

class RepoManager {
  static getRepoList () {
    const urlParams = new URLSearchParams(window.location.search)
    const repoListParam = urlParams.get('repoList')
    return repoListParam ? JSON.parse(repoListParam) : []
  }

  static addRepoToList (repoString) {
    const repoList = RepoManager.getRepoList()
    if (!repoList.includes(repoString)) {
      repoList.push(repoString)
      RepoManager.updateQueryString(repoList)
    }
  }

  static removeRepoFromList (repoString) {
    let repoList = RepoManager.getRepoList()
    repoList = repoList.filter(repo => repo !== repoString)
    RepoManager.updateQueryString(repoList)
  }

  static updateQueryString (repoList) {
    const urlParams = new URLSearchParams(window.location.search)
    urlParams.set('repoList', JSON.stringify(repoList))
    window.location.search = urlParams.toString()
  }
}

class Utils {
  static timeAgo (input) {
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
}
