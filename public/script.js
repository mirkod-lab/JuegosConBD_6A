const userForm = document.querySelector('#user-form');
const tableBody = document.querySelector('#users-table-body');
const messageBox = document.querySelector('#message');
const countLabel = document.querySelector('#user-count');
const tableSummary = document.querySelector('#table-summary');
const searchInput = document.querySelector('#search-input');
const submitButton = document.querySelector('#submit-button');
const cancelButton = document.querySelector('#cancel-button');
const formTitle = document.querySelector('#form-title');
const formIndex = document.querySelector('#form-index');

let editingId = null;
let searchTimer;

// Muestra mensajes de éxito y error en la misma zona accesible.
function showMessage(text, type = 'success') {
  messageBox.textContent = text;
  messageBox.className = `message message-${type}`;
  messageBox.hidden = false;
}

// Centraliza las peticiones y convierte respuestas de error en mensajes útiles.
async function requestApi(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'No se pudo completar la operación.');
  }

  return result;
}

// Construye cada fila con textContent para mostrar los datos como texto, no como HTML.
function createCell(text, className = '') {
  const cell = document.createElement('td');
  cell.textContent = text;
  if (className) cell.className = className;
  return cell;
}

function renderUsers(users) {
  tableBody.replaceChildren();
  countLabel.textContent = users.length;
  tableSummary.textContent = users.length === 1 ? '1 usuario' : `${users.length} usuarios`;

  if (users.length === 0) {
    const row = document.createElement('tr');
    const cell = createCell('No hay usuarios que mostrar.', 'table-state');
    cell.colSpan = 5;
    row.append(cell);
    tableBody.append(row);
    return;
  }

  for (const user of users) {
    const row = document.createElement('tr');
    row.append(
      createCell(user.usu_id, 'id-cell'),
      createCell(user.usu_usuario, 'username-cell'),
      createCell(user.usu_nombre),
      createCell(user.usu_apellido)
    );

    const actions = document.createElement('td');
    actions.className = 'actions-cell';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'row-action edit-action';
    editButton.dataset.action = 'edit';
    editButton.dataset.id = user.usu_id;
    editButton.textContent = 'Editar';
    editButton.setAttribute('aria-label', `Editar usuario ${user.usu_usuario}`);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'row-action delete-action';
    deleteButton.dataset.action = 'delete';
    deleteButton.dataset.id = user.usu_id;
    deleteButton.textContent = 'Eliminar';
    deleteButton.setAttribute('aria-label', `Eliminar usuario ${user.usu_usuario}`);

    actions.append(editButton, deleteButton);
    row.append(actions);
    tableBody.append(row);
  }
}

// Consulta el listado; el filtro se aplica en el servidor sobre usuario y nombre.
async function loadUsers() {
  const search = searchInput.value.trim();
  const query = search ? `?q=${encodeURIComponent(search)}` : '';

  try {
    const users = await requestApi(`/api/usuarios${query}`);
    renderUsers(users);
  } catch (error) {
    tableBody.replaceChildren();
    const row = document.createElement('tr');
    const cell = createCell('No se pudieron cargar los usuarios.', 'table-state');
    cell.colSpan = 5;
    row.append(cell);
    tableBody.append(row);
    showMessage(error.message, 'error');
  }
}

function resetForm() {
  editingId = null;
  userForm.reset();
  formTitle.textContent = 'Nuevo usuario';
  formIndex.textContent = '01';
  submitButton.textContent = 'Guardar usuario';
  cancelButton.hidden = true;
}

userForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const user = Object.fromEntries(new FormData(userForm).entries());
  const isEditing = editingId !== null;
  const url = isEditing ? `/api/usuarios/${editingId}` : '/api/usuarios';

  try {
    await requestApi(url, {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify(user)
    });
    showMessage(isEditing ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.');
    resetForm();
    await loadUsers();
  } catch (error) {
    showMessage(error.message, 'error');
  }
});

cancelButton.addEventListener('click', resetForm);

// Los botones de cada registro comparten este manejador de eventos.
tableBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const id = Number(button.dataset.id);

  if (button.dataset.action === 'edit') {
    try {
      const users = await requestApi('/api/usuarios');
      const user = users.find((item) => item.usu_id === id);
      if (!user) {
        throw new Error('No se encontró el usuario. Actualiza el listado e inténtalo de nuevo.');
      }

      editingId = id;
      userForm.elements.usu_usuario.value = user.usu_usuario;
      userForm.elements.usu_nombre.value = user.usu_nombre;
      userForm.elements.usu_apellido.value = user.usu_apellido;
      formTitle.textContent = `Editar usuario #${id}`;
      formIndex.textContent = '03';
      submitButton.textContent = 'Guardar cambios';
      cancelButton.hidden = false;
      userForm.elements.usu_usuario.focus();
    } catch (error) {
      showMessage(error.message, 'error');
    }
    return;
  }

  if (button.dataset.action === 'delete') {
    const username = button.getAttribute('aria-label').replace('Eliminar usuario ', '');
    if (!window.confirm(`¿Eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) return;

    try {
      await requestApi(`/api/usuarios/${id}`, { method: 'DELETE' });
      if (editingId === id) resetForm();
      showMessage('Usuario eliminado correctamente.');
      await loadUsers();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }
});

searchInput.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(loadUsers, 250);
});

loadUsers();