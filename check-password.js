const bcrypt = require('bcryptjs');

async function checkPassword() {
  const plainPassword = 'demo123';
  const hashedPassword = '$2a$10$1FKe7YpYvjPhPE.uGEBSHuzc6iiTP9kccPg7m7FFkTcIYD8xEq7LG';
  
  try {
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    console.log('Password match:', isMatch);
    
    if (!isMatch) {
      console.log('Password does not match!');
      console.log('Plain password:', plainPassword);
      console.log('Hashed password:', hashedPassword);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPassword();

