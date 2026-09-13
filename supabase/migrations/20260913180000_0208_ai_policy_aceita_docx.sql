-- Knowledge: bucket ai-policy também aceita DOCX.
-- allowed_mime_types é backstop do Storage; a API continua validando extensão.

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'text/markdown',
  'text/x-markdown',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
where id = 'ai-policy';
