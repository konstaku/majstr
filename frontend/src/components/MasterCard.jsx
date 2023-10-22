import professions from './../data/professions.json';
import locations from './../data/locations.json';
import { Card, Collapse, Tag, Typography } from 'antd';
const { Text } = Typography;
import {
  CommentOutlined,
  HeartOutlined,
  WarningOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { useState } from 'react';

export default function MasterCard({ master }) {
  const [contactsCollapsed, setContactsCollapsed] = useState(true);

  const { id, name, professionID, locationID, contacts, about } = master;

  return (
    <Card
      actions={[<HeartOutlined />, <CommentOutlined />, <WarningOutlined />]}
      title={name}
      style={{ alignSelf: 'start' }}
    >
      <div>
        <Tag>{professions.find((p) => p.id === professionID).name.ua}</Tag>
      </div>
      <div>
        <Text type="secondary">
          <EnvironmentOutlined
            style={{ marginRight: '.5rem', marginTop: '1rem' }}
          />
          {locations.find((l) => l.id === locationID).city.ua}
        </Text>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <Text>{about}</Text>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <Collapse
          ghost
          items={[
            {
              label: `${contactsCollapsed ? `Показати` : `Сховати`} контакти`,
              children: contacts.map((contact, index) => (
                <div key={index}>
                  <Text type="secondary">{contact.type}: </Text>
                  <Text type="primary">{contact.value}</Text>
                </div>
              )),
            },
          ]}
          onChange={() => setContactsCollapsed(!contactsCollapsed)}
        ></Collapse>
      </div>
    </Card>
  );
}
