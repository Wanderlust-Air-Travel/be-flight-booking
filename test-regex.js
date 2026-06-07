const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tests = [
    '019EA00C-8814-71FE-A085-8A665B76F6CF', // pos19='A' - VALID?
    '019EA00E-0389-72F0-9291-ECB8DE9D61F9', // pos19='9' - VALID
    '019a8f4a-bb0e-7402-a0c4-27647b89dc71', // pos19='a' - VALID (lowercase)
    '00000000-0000-0000-0000-000000000000', // pos19='0' - INVALID
];
tests.forEach(u => console.log(u, '| pos19:', u.charAt(19), '->', regex.test(u) ? 'VALID' : 'INVALID'));
