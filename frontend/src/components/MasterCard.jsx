import professions from './../data/professions.json';
import locations from './../data/locations.json';
import { Card, Collapse, Tag, Typography, Badge, Avatar } from 'antd';
const { Text } = Typography;
import {
  CommentOutlined,
  HeartOutlined,
  WarningOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { useCallback, useMemo, useRef, useState } from 'react';

const colorPalette = [
  '#F94C66', // coral
  '#F37D5D', // pumpkin
  '#FBB13C', // yellow
  '#FCD34D', // dandelion
  '#BCE784', // green
  '#63B2AF', // teal
  '#5E9FE0', // sky
  '#DF73FF', // magenta
  '#B671F6', // purple
  '#F49AC1', // pink
  '#EF5B5B', // red
  '#FF842D', // orange
  '#E9777D', // rose
  '#FFCF48', // sunflower
  '#F3AB47', // gold
  '#A0E4CB', // turquoise
  '#9DF1DF', // mint
  '#D599FF', // lilac
  '#B5B2FF', // periwinkle
];

export default function MasterCard({ master }) {
  const [contactsCollapsed, setContactsCollapsed] = useState(true);
  const photoRef = useRef(master.photo);
  const randomBackgroundColor = useMemo(
    () => colorPalette[Math.floor(Math.random() * colorPalette.length)],
    []
  );
  const generateContactLayout = useCallback(({ contactType, value }, index) => {
    let contactValue;
    let link;

    switch (contactType) {
      case 'instagram':
        link = `https://www.instagram.com/${value}/`;
        contactValue = <a href={link}>{value}</a>;
        break;
      case 'telegram':
        const handle = value.replace(/@/g, '');
        link = `https://t.me/${handle}`;
        contactValue = <a href={link}>{value}</a>;
        break;
      case 'phone':
        contactValue = <a href={`tel:${value}`}>{value}</a>;
        break;
      default:
        contactValue = value;
    }

    return (
      <div key={index}>
        <Text type="secondary">{contactType}: </Text>
        <Text type="primary">{contactValue}</Text>
      </div>
    );
  }, []);

  const { name, professionID, locationID, contacts, about, likes } = master;

  return (
    <Card
      actions={[
        <Badge size="small" count={likes}>
          <HeartOutlined />
        </Badge>,
        <Badge dot color="#2db7f5">
          <CommentOutlined />
        </Badge>,
        <WarningOutlined />,
      ]}
      title={
        <div>
          <Avatar
            src={photoRef.current && photoRef.current}
            style={
              !photoRef.current && { backgroundColor: randomBackgroundColor }
            }
            className="card-avatar"
          >
            {name[0]}
          </Avatar>
          <span className="card-header-name">{name}</span>
        </div>
      }
      className="master-card"
    >
      <div>
        <Tag>{professions.find((p) => p.id === professionID).name.ua}</Tag>
      </div>
      <div>
        <Text type="secondary">
          <EnvironmentOutlined className="card-content" />
          <span className="card-city">
            {locations.find((l) => l.id === locationID).city.ua}
          </span>
        </Text>
      </div>
      <div className="card-content">
        <Text>{about}</Text>
      </div>
      <div className="card-content">
        <Collapse
          ghost
          items={[
            {
              label: `${contactsCollapsed ? `Показати` : `Сховати`} контакти`,
              children: contacts.map(generateContactLayout),
            },
          ]}
          onChange={() => setContactsCollapsed(!contactsCollapsed)}
        ></Collapse>
      </div>
    </Card>
  );
}
