account = Account.first
puts "Account ID: #{account.id}"

inbox = account.inboxes.find_by(name: "Wower Shopify Store")
if !inbox
  channel = Channel::WebWidget.create!(account: account, website_url: "https://wower-ljgyas0a.myshopify.com")
  inbox = account.inboxes.create!(name: "Wower Shopify Store", channel: channel)
end

# Make sure admin user is member of inbox
user = User.find_by(email: "maddalajashwanth69@gmail.com")
if user && !inbox.members.include?(user)
  inbox.inbox_members.create!(user: user)
end

puts "INBOX_ID: #{inbox.id}"
puts "WEBSITE_TOKEN: #{inbox.channel.website_token}"

webhook_url = "http://api:8000/api/v1/integrations/chatwoot/webhook"
webhook = account.webhooks.find_by(url: webhook_url)
if !webhook
  webhook = account.webhooks.create!(
    url: webhook_url,
    subscriptions: ["message_created", "conversation_created"]
  )
end

puts "WEBHOOK_ID: #{webhook.id}"
puts "WEBHOOK_URL: #{webhook.url}"
puts "WEBHOOK_SUBSCRIPTIONS: #{webhook.subscriptions.join(', ')}"
