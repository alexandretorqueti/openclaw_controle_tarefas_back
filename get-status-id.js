const axios = require('axios');

async function getStatusId() {
  try {
    const response = await axios.get('http://localhost:3001/api/statuses');
    const statuses = response.data.statuses;
    const concluded = statuses.find(s => s.name === 'Concluído');
    if (concluded) {
      console.log('ID do status "Concluído":', concluded.id);
      return concluded.id;
    } else {
      console.log('Status "Concluído" não encontrado. Statuses disponíveis:');
      statuses.forEach(s => console.log(`- ${s.name}: ${s.id}`));
      return null;
    }
  } catch (error) {
    console.error('Erro ao buscar statuses:', error.message);
    return null;
  }
}

getStatusId();